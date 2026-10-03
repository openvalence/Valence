// test_valence_trial -- RFC-099 trial writes (SPEC §9.3): a setting applied
// live without persisting, then committed or reverted.
//
// Harness as test_valence_readygate: InProcessLink + ManualClock +
// XorShift32, raw frames. The catalog is built here: settings-trial (0x0016),
// one settings STATE (0x0080) carrying meta.trial_pending, and its INTENT
// (0x0084). The delegate keeps a live and a stored copy of each setting, so
// "persisted" is observable: only a durable write or onTrialCommit() moves
// the stored copy.
//
// Suite ids: TR-xx.

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include "valence/channel/settings_trial_channel.hpp"
#include "valence/core/clock.hpp"
#include "valence/core/rng.hpp"
#include "valence/hub/hub.hpp"
#include "valence/transport/inprocess_binding.hpp"
#include "valence/wire/catalog_etag.hpp"
#include "valence/wire/frame_header.hpp"
#include "valence/wire/messages/echo.hpp"
#include "valence/wire/messages/goodbye.hpp"
#include "valence/wire/messages/hello.hpp"
#include "valence/wire/messages/intent.hpp"
#include "valence/wire/messages/nack.hpp"
#include "valence/wire/messages/welcome.hpp"
#include "valence/wire/raw/catalog_ready.hpp"

#include <array>
#include <cstring>
#include <optional>
#include <vector>

using namespace valence;

namespace {

constexpr uint16_t kSettingsState = 0x0080;
constexpr uint16_t kSettingsSet = 0x0084;

bool buildTrialCatalog(Catalog32& c) {
    if (!addSettingsTrialChannel(c)) return false;
    c.addEntry({.id = kSettingsState, .name = "settings", .cls = ChannelClass::STATE, .dir = Direction::h2c,
                .access = AccessLevel::watch, .maxRateHz = 0.0f, .defaultPriority = Priority::normal,
                .hasSettingChannel = true, .settingChannel = kSettingsSet});
    c.addLayoutField({.name = "speed", .type = PackedFieldType::f32, .unit = "mm/s", .scale = 1.0f,
                      .settingKey = 1, .hasSettingKey = true});
    c.addLayoutField({.name = "depth", .type = PackedFieldType::u8, .unit = "%", .scale = 1.0f,
                      .settingKey = 2, .hasSettingKey = true});
    c.addLayoutField({.name = "enable", .type = PackedFieldType::u8, .unit = "", .scale = 1.0f,
                      .settingKey = 4, .hasSettingKey = true});
    c.addBitfieldField({.name = "trial_mask", .type = PackedFieldType::bitfield8, .unit = "flag", .scale = 1.0f,
                        .role = field_roles::meta_trial_pending},
                       {"speed", "depth", "enable"});
    c.addEntry({.id = kSettingsSet, .name = "settings-set", .cls = ChannelClass::INTENT, .dir = Direction::c2h,
                .access = AccessLevel::control, .maxRateHz = 50.0f, .defaultPriority = Priority::normal});
    c.addSchemaField({.key = 1, .name = "speed", .type = CborFieldType::f32_t, .unit = "mm/s",
                      .hasMin = true, .hasMax = true, .min = 0.0f, .max = 1000.0f});
    c.addSchemaField({.key = 2, .name = "depth", .type = CborFieldType::uint_t, .unit = "%"});
    c.addSchemaField({.key = 3, .name = "label", .type = CborFieldType::tstr_t, .unit = ""});
    c.addSchemaField({.key = 4, .name = "enable", .type = CborFieldType::bool_t, .unit = ""});
    return !c.overflow;
}

struct Values {
    float speed = 100.0f;
    uint64_t depth = 50;
    bool enable = false;
    bool operator==(const Values&) const = default;
};

class TrialDelegate final : public HubDelegate {
public:
    Values live{};
    Values stored{};
    int applyCount = 0;
    int commits = 0;
    int restores = 0;
    bool trialApply = false;

    AccessLevel validateToken(std::span<const std::byte>, std::span<const std::byte>, bool hasToken) override {
        return hasToken ? AccessLevel::control : AccessLevel::watch;
    }
    Result<IntentValueMap, NackCode> applyIntent(uint16_t channel_id, const IntentValueMap& req, AccessLevel,
                                                 bool& cfgChanged) override {
        ++applyCount;
        if (channel_id != kSettingsSet) return Result<IntentValueMap, NackCode>::err(NackCode::UNSUPPORTED_OP);
        const Values was = live;
        IntentValueMap out{};
        for (uint32_t i = 0; i < req.count; ++i) {
            const auto& f = req.fields[i];
            if (f.key == 1) live.speed = std::min(1000.0f, std::max(0.0f, f.value.f32_val));
            else if (f.key == 2) live.depth = f.value.u64_val;
            else if (f.key == 4) live.enable = f.value.bool_val;
            else continue;
            out.fields[out.count++] = valueOf(f.key);
        }
        cfgChanged = !(was == live);
        if (!trialApply) stored = live;   // a durable write persists everything live
        return Result<IntentValueMap, NackCode>::ok(out);
    }
    std::optional<IntentValue> trialBaseline(uint16_t channel_id, uint8_t key) override {
        if (channel_id != kSettingsSet || (key != 1 && key != 2 && key != 4)) return std::nullopt;
        return valueOf(key).value;
    }
    Result<IntentValueMap, NackCode> applyTrialIntent(uint16_t channel_id, const IntentValueMap& req,
                                                      AccessLevel role, bool& cfgChanged) override {
        trialApply = true;
        auto r = applyIntent(channel_id, req, role, cfgChanged);
        trialApply = false;
        return r;
    }
    void restoreTrial(uint16_t, const IntentValueMap& b, bool& cfgChanged) override {
        ++restores;
        const Values was = live;
        for (uint32_t i = 0; i < b.count; ++i) set(live, b.fields[i]);
        cfgChanged = !(was == live);
    }
    void onTrialCommit(uint16_t, const IntentValueMap& keys) override {
        ++commits;
        for (uint32_t i = 0; i < keys.count; ++i) set(stored, valueOf(keys.fields[i].key));
    }
    void onEstop(uint8_t, uint8_t) override {}

private:
    IntentValueField valueOf(uint8_t key) const {
        if (key == 1) return {1, IntentValue::ofF32(live.speed)};
        if (key == 2) return {2, IntentValue::ofU64(live.depth)};
        return {4, IntentValue::ofBool(live.enable)};
    }
    static void set(Values& v, const IntentValueField& f) {
        if (f.key == 1) v.speed = f.value.f32_val;
        else if (f.key == 2) v.depth = f.value.u64_val;
        else if (f.key == 4) v.enable = f.value.bool_val;
    }
};

void writeFrame(ITransport& ep, FrameType type, uint16_t channel, std::span<const std::byte> payload) {
    std::array<std::byte, 400> buf{};
    FrameHeader h;
    h.type = uint8_t(type);
    h.channel = channel;
    h.len = uint16_t(payload.size());
    size_t pos = encodeFrameHeader(h, std::span<std::byte>(buf));
    REQUIRE(pos > 0);
    if (!payload.empty()) std::memcpy(buf.data() + pos, payload.data(), payload.size());
    REQUIRE(ep.write(std::span<const std::byte>(buf.data(), pos + payload.size())));
}

struct Reply {
    FrameType type;
    uint16_t channel;
    std::vector<std::byte> payload;
};

std::vector<Reply> tick(Hub& hub, ManualClock& clock, ITransport& ep) {
    clock.advanceUs(1000);
    hub.update(clock.nowUs());
    std::vector<Reply> out;
    while (auto fb = ep.read()) {
        auto h = fb->header();
        if (!h) continue;
        auto pl = fb->payload();
        out.push_back(Reply{FrameType(h->type), h->channel, std::vector<std::byte>(pl.begin(), pl.end())});
    }
    return out;
}

std::optional<NackMsg> findNack(const std::vector<Reply>& rs) {
    for (const auto& r : rs)
        if (r.type == FrameType::NACK)
            if (auto n = decodeNack(std::span<const std::byte>(r.payload))) return n.value();
    return std::nullopt;
}

std::optional<EchoMsg> findEcho(const std::vector<Reply>& rs) {
    for (const auto& r : rs)
        if (r.type == FrameType::ECHO)
            if (auto e = decodeEcho(std::span<const std::byte>(r.payload))) return e.value();
    return std::nullopt;
}

// HELLO with a token (control) and the catalog's etag, so the session is
// READY at WELCOME; optionally subscribed to the settings STATE.
void connect(Hub& hub, ManualClock& clock, ITransport& ep, uint8_t idByte, const Catalog32& cat, bool subscribe) {
    HelloMsg m{};
    m.proto_ver = kProtocolVersion;
    m.client_kind = "sim";
    m.client_name = "trial";
    m.instance_id.fill(std::byte{0});
    m.instance_id[0] = std::byte{idByte};
    m.has_token = true;
    m.token.fill(std::byte{0xAA});
    std::array<std::byte, 8192> scratch{};
    m.has_catalog_etag = true;
    m.catalog_etag = catalogEtag(cat, std::span<std::byte>(scratch));
    if (subscribe) {
        m.subscriptions_count = 1;
        m.subscriptions[0] = {kSettingsState, 0.0f, 1};
    }
    std::array<std::byte, 400> buf{};
    size_t n = encodeHello(m, std::span<std::byte>(buf));
    REQUIRE(n > 0);
    writeFrame(ep, FrameType::HELLO, 0, std::span<const std::byte>(buf.data(), n));
    tick(hub, clock, ep);
}

uint16_t g_intentId = 1;

std::vector<Reply> send(Hub& hub, ManualClock& clock, ITransport& ep, uint16_t channel,
                        std::vector<IntentValueField> fields, bool trial) {
    IntentMsg m{};
    m.channel_id = channel;
    m.intent_id = g_intentId++;
    m.value_count = uint32_t(fields.size());
    for (size_t i = 0; i < fields.size(); ++i) m.value[i] = fields[i];
    m.has_trial = trial;
    m.trial = trial;
    std::array<std::byte, 200> buf{};
    size_t n = encodeIntent(m, std::span<std::byte>(buf));
    REQUIRE(n > 0);
    writeFrame(ep, FrameType::INTENT, channel, std::span<const std::byte>(buf.data(), n));
    return tick(hub, clock, ep);
}

std::vector<Reply> trialOp(Hub& hub, ManualClock& clock, ITransport& ep, uint8_t op) {
    return send(hub, clock, ep, channels::settings_trial, {{trial_value::op, IntentValue::ofU64(op)}}, false);
}

IntentValueField speed(float v) { return {1, IntentValue::ofF32(v)}; }

struct Rig {
    Catalog32 cat;
    ManualClock clock;
    XorShift32 rng{9901};
    TrialDelegate del;
    std::optional<Hub> hub;
    InProcessLink a{clock, rng};
    InProcessLink b{clock, rng};
    Rig() {
        REQUIRE(buildTrialCatalog(cat));
        hub.emplace(cat, clock, rng, del);
        REQUIRE(hub->attachTransport(a.endpointA()));
        REQUIRE(a.endpointB().open());
        connect(*hub, clock, a.endpointB(), 1, cat, false);
        REQUIRE(hub->sessionBySlot(0) != nullptr);
        REQUIRE(hub->sessionBySlot(0)->ready);
    }
    void addSecond(bool subscribe = false) {
        REQUIRE(hub->attachTransport(b.endpointA()));
        REQUIRE(b.endpointB().open());
        connect(*hub, clock, b.endpointB(), 2, cat, subscribe);
    }
    ITransport& A() { return a.endpointB(); }
    ITransport& B() { return b.endpointB(); }
};

}  // namespace

TEST_CASE("TR-00: the trial key round-trips on INTENT and is absent by default") {
    IntentMsg m{};
    m.channel_id = kSettingsSet;
    m.intent_id = 5;
    m.value_count = 1;
    m.value[0] = speed(200.0f);
    std::array<std::byte, 64> buf{};
    size_t n = encodeIntent(m, std::span<std::byte>(buf));
    auto plain = decodeIntent(std::span<const std::byte>(buf.data(), n));
    REQUIRE(plain);
    CHECK_FALSE(plain.value().has_trial);
    m.has_trial = true;
    m.trial = true;
    n = encodeIntent(m, std::span<std::byte>(buf));
    auto t = decodeIntent(std::span<const std::byte>(buf.data(), n));
    REQUIRE(t);
    CHECK(t.value().has_trial);
    CHECK(t.value().trial);
}

TEST_CASE("TR-01: a trial write applies live, bumps cfg_gen, shows in STATE and is not persisted") {
    Rig r;
    r.addSecond(/*subscribe=*/true);
    const uint16_t gen0 = r.hub->cfgGen();
    auto rs = send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(250.0f)}, true);
    auto e = findEcho(rs);
    REQUIRE(e);
    CHECK(e->applied[0].value.f32_val == doctest::Approx(250.0f));
    CHECK(r.hub->cfgGen() == uint16_t(gen0 + 1));
    CHECK(r.del.live.speed == doctest::Approx(250.0f));
    CHECK(r.del.stored.speed == doctest::Approx(100.0f));
    CHECK(r.hub->trialCount() == 1);
    CHECK(r.hub->trialMask(kSettingsState) == 0x01);
    CHECK(r.hub->trialBaselineOf(kSettingsSet, 1)->f32_val == doctest::Approx(100.0f));

    // The delegate publishes the effective value with its mask; B sees both.
    std::array<std::byte, 7> st{};
    std::memcpy(st.data(), &r.del.live.speed, 4);
    st[4] = std::byte(r.del.live.depth);
    st[5] = std::byte(r.del.live.enable ? 1 : 0);
    st[6] = std::byte(r.hub->trialMask(kSettingsState));
    REQUIRE(r.hub->publishState(kSettingsState, st));
    auto seen = tick(*r.hub, r.clock, r.B());
    bool got = false;
    for (const auto& x : seen) {
        if (x.type != FrameType::STATE || x.channel != kSettingsState) continue;
        float v = 0.0f;
        std::memcpy(&v, x.payload.data(), 4);
        CHECK(v == doctest::Approx(250.0f));
        CHECK(uint8_t(x.payload[6]) == 0x01);
        got = true;
    }
    CHECK(got);
}

TEST_CASE("TR-02: commit persists through the delegate's commit hook and leaves cfg_gen") {
    Rig r;
    send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(300.0f), {4, IntentValue::ofBool(true)}}, true);
    const uint16_t gen = r.hub->cfgGen();
    auto rs = trialOp(*r.hub, r.clock, r.A(), trial_ops::commit);
    auto e = findEcho(rs);
    REQUIRE(e);
    CHECK(e->applied_count == 1);
    CHECK(e->applied[0].value.u64_val == trial_ops::commit);
    CHECK(r.hub->cfgGen() == gen);
    CHECK(r.del.commits == 1);
    CHECK(r.del.stored.speed == doctest::Approx(300.0f));
    CHECK(r.del.stored.enable);
    CHECK(r.hub->trialCount() == 0);
    CHECK(r.hub->trialMask(kSettingsState) == 0);
}

TEST_CASE("TR-03: revert restores the FIRST baseline and bumps cfg_gen") {
    Rig r;
    send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(200.0f)}, true);
    send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(300.0f)}, true);
    CHECK(r.hub->trialCount() == 1);
    const uint16_t gen = r.hub->cfgGen();
    auto e = findEcho(trialOp(*r.hub, r.clock, r.A(), trial_ops::revert));
    REQUIRE(e);
    CHECK(e->applied[0].value.u64_val == trial_ops::revert);
    CHECK(r.del.live.speed == doctest::Approx(100.0f));
    CHECK(r.del.stored.speed == doctest::Approx(100.0f));
    CHECK(r.hub->cfgGen() == uint16_t(gen + 1));
    CHECK(e->cfg_gen == r.hub->cfgGen());
    CHECK(r.hub->trialCount() == 0);

    // An empty set: both ops are accepted no-ops.
    CHECK(findEcho(trialOp(*r.hub, r.clock, r.A(), trial_ops::revert)));
    CHECK(findEcho(trialOp(*r.hub, r.clock, r.A(), trial_ops::commit)));
    CHECK(r.hub->cfgGen() == uint16_t(gen + 1));
}

TEST_CASE("TR-04: a session ending reverts its trials: GOODBYE, and a transport loss (STALE park)") {
    SUBCASE("GOODBYE") {
        Rig r;
        send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(400.0f)}, true);
        GoodbyeMsg g{};
        g.code = NackCode::NORMAL_CLOSURE;
        std::array<std::byte, 64> buf{};
        size_t n = encodeGoodbye(g, std::span<std::byte>(buf));
        writeFrame(r.A(), FrameType::GOODBYE, 0, std::span<const std::byte>(buf.data(), n));
        tick(*r.hub, r.clock, r.A());
        CHECK(r.del.live.speed == doctest::Approx(100.0f));
        CHECK(r.del.restores == 1);
        CHECK(r.hub->trialCount() == 0);
    }
    SUBCASE("transport loss parks the session STALE") {
        Rig r;
        send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(400.0f)}, true);
        r.hub->detachTransport(r.a.endpointA());
        tick(*r.hub, r.clock, r.A());
        REQUIRE(r.hub->sessionBySlot(0) != nullptr);
        CHECK(r.hub->sessionBySlot(0)->state == HubSessionState::STALE);
        CHECK(r.del.live.speed == doctest::Approx(100.0f));
        CHECK(r.hub->trialCount() == 0);
    }
}

TEST_CASE("TR-05: a second session is refused TRIAL_CONFLICT on a trialed key, trial or durable") {
    Rig r;
    r.addSecond();
    send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(250.0f)}, true);
    const int applied = r.del.applyCount;

    auto n = findNack(send(*r.hub, r.clock, r.B(), kSettingsSet, {speed(600.0f)}, true));
    REQUIRE(n);
    CHECK(n->code == NackCode::TRIAL_CONFLICT);
    n = findNack(send(*r.hub, r.clock, r.B(), kSettingsSet, {speed(600.0f), {2, IntentValue::ofU64(70)}}, false));
    REQUIRE(n);
    CHECK(n->code == NackCode::TRIAL_CONFLICT);
    CHECK(r.del.applyCount == applied);   // whole intent refused, no key applied
    CHECK(r.del.live.depth == 50);

    // A different key is B's to trial.
    CHECK(findEcho(send(*r.hub, r.clock, r.B(), kSettingsSet, {{2, IntentValue::ofU64(70)}}, true)));
    CHECK(r.hub->trialCount() == 2);
    CHECK(r.hub->trialMask(kSettingsState) == 0x03);
    // A's revert touches only A's key.
    trialOp(*r.hub, r.clock, r.A(), trial_ops::revert);
    CHECK(r.del.live.speed == doctest::Approx(100.0f));
    CHECK(r.del.live.depth == 70);
    CHECK(r.hub->trialMask(kSettingsState) == 0x02);
}

TEST_CASE("TR-06: a key the delegate cannot restore is refused UNSUPPORTED_OP and nothing applies") {
    Rig r;
    const int applied = r.del.applyCount;
    auto n = findNack(send(*r.hub, r.clock, r.A(), kSettingsSet,
                           {speed(250.0f), {3, IntentValue::ofTstr("x")}}, true));
    REQUIRE(n);
    CHECK(n->code == NackCode::UNSUPPORTED_OP);
    CHECK(r.del.applyCount == applied);
    CHECK(r.hub->trialCount() == 0);
}

TEST_CASE("TR-07: a durable write by the trial's own session ends the trial and persists the key") {
    Rig r;
    send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(250.0f)}, true);
    send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(250.0f)}, false);   // same value: no cfg change
    CHECK(r.hub->trialCount() == 0);
    CHECK(r.del.commits == 1);
    CHECK(r.del.stored.speed == doctest::Approx(250.0f));
    trialOp(*r.hub, r.clock, r.A(), trial_ops::revert);
    CHECK(r.del.live.speed == doctest::Approx(250.0f));
}

TEST_CASE("TR-08: ESTOP reverts nothing") {
    Rig r;
    send(*r.hub, r.clock, r.A(), kSettingsSet, {speed(250.0f)}, true);
    r.hub->latchEstop(safety_causes::user, 0);
    tick(*r.hub, r.clock, r.A());
    CHECK(r.hub->estopLatched());
    CHECK(r.del.live.speed == doctest::Approx(250.0f));
    CHECK(r.hub->trialCount() == 1);
}
