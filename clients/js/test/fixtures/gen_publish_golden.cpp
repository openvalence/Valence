// gen_publish_golden -- emits the golden bytes valence-publish.test.mjs checks.
// Constraints: every byte comes from lib/valence's own encoders (encodeHello,
//   encodePublish, encodeGrant, encodeWelcome, BundleWriter, packField,
//   encodeFrameHeader); nothing here is hand-assembled wire.
// Build and run from the repo root:
//   g++ -std=c++20 -I lib/valence/include clients/js/test/fixtures/gen_publish_golden.cpp -o gen.exe && ./gen.exe
#include <cstdio>
#include <span>
#include <vector>

#include "valence/channel/catalog.hpp"
#include "valence/wire/frame_header.hpp"
#include "valence/wire/messages/grant.hpp"
#include "valence/wire/messages/hello.hpp"
#include "valence/wire/messages/publish.hpp"
#include "valence/wire/messages/welcome.hpp"
#include "valence/wire/packed/layout_codec.hpp"
#include "valence/wire/stream_bundle.hpp"

using namespace valence;

static void dump(const char* name, std::span<const std::byte> b) {
    std::printf("%s ", name);
    for (std::byte x : b) std::printf("%02X", unsigned(x));
    std::printf("\n");
}

static std::vector<std::byte> frame(FrameType t, uint16_t ch, uint16_t seq, std::span<const std::byte> p) {
    std::vector<std::byte> out(kHeaderBytes + p.size());
    FrameHeader h;
    h.type = uint8_t(t);
    h.channel = ch;
    h.seq = seq;
    h.len = uint16_t(p.size());
    encodeFrameHeader(h, std::span<std::byte>(out));
    for (size_t i = 0; i < p.size(); ++i) out[kHeaderBytes + i] = p[i];
    return out;
}

int main() {
    std::array<std::byte, 512> buf{};

    // HELLO carrying two publish wishes: a plain one and one with burst + family.
    HelloMsg h;
    h.client_kind = "test";
    h.client_name = "golden";
    for (int i = 0; i < 8; ++i) h.instance_id[i] = std::byte(i + 1);
    h.publishes_count = 2;
    h.publishes[0] = PublishWish{.channel_id = 0x2100, .rate_hz = 50.0f};
    h.publishes[1] = PublishWish{.channel_id = 0x2101, .rate_hz = 20.0f, .has_burst = true, .burst = 40.0f,
                                 .has_curve_family = true, .curve_family = 1};
    size_t n = encodeHello(h, buf);
    dump("HELLO_FRAME", frame(FrameType::HELLO, 0, 0, std::span(buf.data(), n)));

    // PUBLISH mid-session: one wish.
    PublishMsg pm;
    pm.publishes_count = 1;
    pm.publishes[0] = PublishWish{.channel_id = 0x2101, .rate_hz = 20.0f, .has_burst = true, .burst = 40.0f,
                                  .has_curve_family = true, .curve_family = 2};
    n = encodePublish(pm, buf);
    dump("PUBLISH_FRAME", frame(FrameType::PUBLISH, 0, 0, std::span(buf.data(), n)));

    // GRANT answering that PUBLISH: effective family downgraded to c1 (1), wish echoed as 2.
    GrantMsg g;
    g.granted_publishes_count = 1;
    g.granted_publishes[0] = GrantedPublish{.channel_id = 0x2101, .granted_rate_hz = 20.0f,
                                            .has_burst = true, .burst = 40.0f,
                                            .has_curve_family = true, .curve_family = 1,
                                            .has_requested_curve_family = true,
                                            .requested_curve_family = 2};
    n = encodeGrant(g, buf);
    dump("GRANT_PUBLISH_PAYLOAD", std::span(buf.data(), n));

    // GRANT answering a PUBLISH that granted nothing (what the reference hub emits:
    // key 36 present and empty, §10.2).
    GrantMsg empty;
    empty.has_granted_publishes = true;
    n = encodeGrant(empty, buf);
    dump("GRANT_EMPTY_PAYLOAD", std::span(buf.data(), n));

    // WELCOME with one granted publish (0x2100 at 50 Hz, no burst asked).
    WelcomeMsg w;
    w.session_id = 0x01020304;
    w.boot_id = 0x0A0B0C0D;
    w.cfg_gen = 7;
    w.roles = 1;
    w.deadman_ms = 2000;
    w.granted_publishes_count = 1;
    w.granted_publishes[0] = GrantedPublish{.channel_id = 0x2100, .granted_rate_hz = 50.0f};
    n = encodeWelcome(w, buf);
    dump("WELCOME_PAYLOAD", std::span(buf.data(), n));

    // STREAM samples-kind bundle on a {u16 target x10000, i16 vel x1000} layout.
    const LayoutField tgt{.type = PackedFieldType::u16, .scale = 10000.0f};
    const LayoutField vel{.type = PackedFieldType::i16, .scale = 1000.0f};
    const LayoutField dur{.type = PackedFieldType::u16, .scale = 1.0f};
    std::array<std::byte, 6> s{};
    {
        BundleWriter bw(buf, 0x12345678u, 4);
        packField(tgt, 0.5f, std::span(s).subspan(0, 2));
        packField(vel, -0.25f, std::span(s).subspan(2, 2));
        bw.addSample(0, std::span(s.data(), 4));
        packField(tgt, 0.75f, std::span(s).subspan(0, 2));
        packField(vel, 0.125f, std::span(s).subspan(2, 2));
        bw.addSample(10000, std::span(s.data(), 4));
        n = bw.finalize();
        dump("STREAM_SAMPLES_FRAME", frame(FrameType::STREAM, 0x2100, 7, std::span(buf.data(), n)));
    }

    // STREAM segments-kind bundle, one {u16 target, u16 duration_ms, i16 end_vel} segment.
    {
        BundleWriter bw(buf, 0xFFFFFF00u, 6);
        packField(tgt, 0.25f, std::span(s).subspan(0, 2));
        packField(dur, 120.0f, std::span(s).subspan(2, 2));
        packField(vel, -0.5f, std::span(s).subspan(4, 2));
        bw.addSample(0, s);
        n = bw.finalize();
        dump("STREAM_SEGMENT_FRAME", frame(FrameType::STREAM, 0x2101, 0xFFFF, std::span(buf.data(), n)));
    }
    return 0;
}
