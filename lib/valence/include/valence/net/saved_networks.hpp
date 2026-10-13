// valence-net -- the saved-network list and the join rule (RFC-116, amending
// SPEC §13.9): up to saved_networks_max credentials in list order, the edits
// the provisioning ops make, the persisted byte form, and the order a station
// tries them in.
// Constraints:
// - CREDENTIALS NEVER LEAVE THROUGH THIS TYPE. Nothing here logs, and the one
//   accessor that yields a passphrase is passphrase(), which a station calls to
//   build its join config and nobody else needs. A removed or replaced entry
//   is wiped with volatile stores.
// - The list is CONTIGUOUS: entries 0..count()-1 are used, in the order the
//   user chose. A remove closes the gap; indices after it shift down.
// - id() is stable across moves and changes on every save, so two tasks can
//   name "the network the station joined" across a reorder without sharing
//   the list. 0 is never an id.
// - Hardware-free and heap-free; the platform scan and join stay in each
//   firmware.
// - TODO(RFC-116): the wire numbers in `draft` move to the generated
//   registry_constants.hpp when the RFC lands.
// See: SPEC.md §8.8 (Secrets), §13.9; RFC-QUEUE.md RFC-116
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <optional>
#include <span>
#include <string_view>

#include "valence/generated/registry_constants.hpp"

namespace valence::net {

// RFC-116 draft numbers, not yet in the registry.
namespace draft {
inline constexpr uint16_t ch_networks = 0x0017;        // STATE, watch
inline constexpr uint16_t ch_network_names = 0x0018;   // STATE, configure
inline constexpr uint8_t op_net_save = 2;
inline constexpr uint8_t op_net_remove = 3;
inline constexpr uint8_t op_net_move = 4;
inline constexpr uint8_t key_slot = 6;
inline constexpr uint8_t key_to = 7;
inline constexpr uint8_t key_generation = 8;
inline constexpr uint16_t nack_live_network = 0x0308;
inline constexpr size_t saved_networks_max = 4;
inline constexpr int join_near_tie_db = 3;
}  // namespace draft

// 0x000F's own schema keys (registry core_channels 0x000F).
inline constexpr uint8_t kKeyOp = 1;
inline constexpr uint8_t kKeySsid = 2;
inline constexpr uint8_t kKeyPassphrase = 3;
inline constexpr uint8_t kKeyIpv4 = 4;
inline constexpr uint8_t kKeyWsPort = 5;

// IEEE 802.11: an SSID is 1..32 octets. A WPA2 passphrase is 8..63 printable
// ASCII, or exactly 64 hex digits of raw PSK. Empty is an open network.
inline constexpr size_t kSsidMax = 32;
inline constexpr size_t kPassMin = 8;
inline constexpr size_t kPassMax = 63;
inline constexpr size_t kPskHexLen = 64;

// A scan never reports this; it marks an entry the last scan did not see.
inline constexpr int8_t kRssiUnseen = -128;

// nullopt = acceptable; else the refusal detail (a literal, never a credential).
inline std::optional<std::string_view> checkCredentials(std::string_view ssid, std::string_view pass) {
    if (ssid.empty() || ssid.size() > kSsidMax) return "ssid length";
    // A station config is NUL-terminated below 32 octets.
    if (ssid.find('\0') != std::string_view::npos) return "ssid";
    if (pass.empty()) return std::nullopt;
    if (pass.size() == kPskHexLen) {
        for (char c : pass) {
            const bool hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            if (!hex) return "passphrase";
        }
        return std::nullopt;
    }
    if (pass.size() < kPassMin || pass.size() > kPassMax) return "passphrase length";
    for (char c : pass) {
        if (c < 0x20 || c > 0x7E) return "passphrase";
    }
    return std::nullopt;
}

inline void wipeBytes(void* p, size_t n) {
    // volatile: plain stores to memory nobody reads again are dead stores the
    // optimizer may drop.
    volatile uint8_t* b = static_cast<volatile uint8_t*>(p);
    for (size_t i = 0; i < n; ++i) b[i] = 0;
}

class SavedNetworks {
public:
    static constexpr size_t kCapacity = draft::saved_networks_max;
    // joinTarget() always leaves the live entry a neighbor to replace.
    static_assert(kCapacity >= 2);
    // magic 'V' 'N', version, count, then kCapacity x {ssidLen, passLen,
    // ssid[32], pass[64]}.
    static constexpr size_t kEntryBytes = 2 + kSsidMax + kPskHexLen;
    static constexpr size_t kBlobBytes = 4 + kCapacity * kEntryBytes;

    enum class Error : uint8_t { full, no_such_slot, credentials, duplicate };

    struct Saved {
        size_t slot;
        bool replaced;
    };

    SavedNetworks() = default;
    SavedNetworks(const SavedNetworks&) = default;
    SavedNetworks& operator=(const SavedNetworks&) = default;
    ~SavedNetworks() { wipeBytes(_e.data(), sizeof _e); }

    size_t count() const { return _count; }
    static constexpr size_t capacity() { return kCapacity; }
    std::string_view ssid(size_t i) const { return i < _count ? _e[i].ssidView() : std::string_view{}; }
    std::string_view passphrase(size_t i) const { return i < _count ? _e[i].passView() : std::string_view{}; }
    bool open(size_t i) const { return i < _count && _e[i].passLen == 0; }
    uint8_t id(size_t i) const { return i < _count ? _e[i].id : 0; }

    std::optional<size_t> find(std::string_view ssid) const {
        for (size_t i = 0; i < _count; ++i)
            if (_e[i].ssidView() == ssid) return i;
        return std::nullopt;
    }
    std::optional<size_t> findId(uint8_t id) const {
        if (id == 0) return std::nullopt;
        for (size_t i = 0; i < _count; ++i)
            if (_e[i].id == id) return i;
        return std::nullopt;
    }

    // The entry save(slot, ssid, ...) would overwrite; nullopt when it would
    // append (or refuse).
    std::optional<size_t> saveTarget(std::optional<size_t> slot, std::string_view ssid) const {
        if (slot) return *slot < _count ? slot : std::nullopt;
        return find(ssid);
    }

    // wifi_join's target (RFC-116 item 3): `slot`, else the entry with the
    // same SSID, else nullopt (an append), else, on a full list, the last
    // entry in list order that is not `live`. A join is never refused for
    // room.
    std::optional<size_t> joinTarget(std::optional<size_t> slot, std::string_view ssid,
                                     std::optional<size_t> live) const {
        if (slot || find(ssid)) return saveTarget(slot, ssid);
        if (_count < kCapacity) return std::nullopt;
        return live == _count - 1 ? _count - 2 : _count - 1;
    }

    // `slot` names an entry to replace; nullopt replaces the entry with the
    // same SSID, else appends. Either way the entry gets a new id. SSIDs are
    // unique: a slot whose replacement would repeat another entry's SSID is
    // refused.
    struct SaveResult {
        bool ok;
        Saved saved;
        Error error;
    };
    SaveResult save(std::optional<size_t> slot, std::string_view ssid, std::string_view pass) {
        if (checkCredentials(ssid, pass)) return {false, {}, Error::credentials};
        size_t at = _count;
        if (slot) {
            if (*slot >= _count) return {false, {}, Error::no_such_slot};
            if (const auto same = find(ssid); same && *same != *slot) return {false, {}, Error::duplicate};
            at = *slot;
        } else if (const auto same = find(ssid)) {
            at = *same;
        }
        if (at >= kCapacity) return {false, {}, Error::full};
        const bool replaced = at < _count;
        Entry& e = _e[at];
        wipeBytes(&e, sizeof e);
        std::memcpy(e.ssid.data(), ssid.data(), ssid.size());
        std::memcpy(e.pass.data(), pass.data(), pass.size());
        e.ssidLen = uint8_t(ssid.size());
        e.passLen = uint8_t(pass.size());
        e.id = nextId();
        if (!replaced) ++_count;
        return {true, {at, replaced}, Error::full};
    }

    bool remove(size_t slot) {
        if (slot >= _count || _count > kCapacity) return false;
        for (size_t i = slot; i + 1 < _count; ++i) _e[i] = _e[i + 1];
        --_count;
        wipeBytes(&_e[_count], sizeof(Entry));
        return true;
    }

    // Takes the entry at `from` out and reinserts it at `to`; the entries
    // between shift by one.
    bool move(size_t from, size_t to) {
        if (from >= _count || to >= _count) return false;
        if (from == to) return true;
        Entry moving = _e[from];
        if (from < to) {
            for (size_t i = from; i < to; ++i) _e[i] = _e[i + 1];
        } else {
            for (size_t i = from; i > to; --i) _e[i] = _e[i - 1];
        }
        _e[to] = moving;
        wipeBytes(&moving, sizeof moving);
        return true;
    }

    void clear() {
        wipeBytes(_e.data(), sizeof _e);
        _count = 0;
    }

    // The persisted form. Returns kBlobBytes, or 0 when `out` is short.
    size_t encode(std::span<uint8_t> out) const {
        if (out.size() < kBlobBytes) return 0;
        std::memset(out.data(), 0, kBlobBytes);
        out[0] = 'V';
        out[1] = 'N';
        out[2] = kVersion;
        out[3] = uint8_t(_count);
        for (size_t i = 0; i < _count; ++i) {
            uint8_t* p = out.data() + 4 + i * kEntryBytes;
            p[0] = _e[i].ssidLen;
            p[1] = _e[i].passLen;
            std::memcpy(p + 2, _e[i].ssid.data(), _e[i].ssidLen);
            std::memcpy(p + 2 + kSsidMax, _e[i].pass.data(), _e[i].passLen);
        }
        return kBlobBytes;
    }

    // False leaves the list empty: a wrong magic, version, length or entry.
    bool decode(std::span<const uint8_t> in) {
        clear();
        if (in.size() != kBlobBytes || in[0] != 'V' || in[1] != 'N' || in[2] != kVersion || in[3] > kCapacity)
            return false;
        for (size_t i = 0; i < in[3]; ++i) {
            const uint8_t* p = in.data() + 4 + i * kEntryBytes;
            if (p[0] > kSsidMax || p[1] > kPskHexLen) {
                clear();
                return false;
            }
            const std::string_view s(reinterpret_cast<const char*>(p + 2), p[0]);
            const std::string_view w(reinterpret_cast<const char*>(p + 2 + kSsidMax), p[1]);
            if (!save(std::nullopt, s, w).ok) {
                clear();
                return false;
            }
        }
        return true;
    }

private:
    static constexpr uint8_t kVersion = 1;

    struct Entry {
        std::array<char, kSsidMax> ssid{};
        std::array<char, kPskHexLen> pass{};
        uint8_t ssidLen = 0;
        uint8_t passLen = 0;
        uint8_t id = 0;
        std::string_view ssidView() const { return {ssid.data(), ssidLen}; }
        std::string_view passView() const { return {pass.data(), passLen}; }
    };

    uint8_t nextId() {
        for (;;) {
            _lastId = uint8_t(_lastId + 1);
            if (_lastId == 0) continue;
            bool taken = false;
            for (size_t i = 0; i < _count; ++i) taken |= _e[i].id == _lastId;
            if (!taken) return _lastId;
        }
    }

    std::array<Entry, kCapacity> _e{};
    size_t _count = 0;
    uint8_t _lastId = 0;
};

// One BSSID a scan heard.
struct Sighting {
    std::string_view ssid;
    int8_t rssi;
};

// The join rule (RFC-116): the visible saved networks first, strongest first,
// where an entry within join_near_tie_db of the strongest remaining one and
// earlier in the list goes first; then every entry the scan did not see (a
// hidden network, or one out of range), in list order. An entry's signal is
// its strongest BSSID. One below `floorDbm` counts as unseen for the order
// (the station would refuse it) but still reports its RSSI.
// Writes the order to `order` and each entry's strongest RSSI (kRssiUnseen
// when not heard) to `rssi`; returns list.count().
inline size_t joinOrder(const SavedNetworks& list, std::span<const Sighting> heard,
                        std::span<uint8_t, SavedNetworks::kCapacity> order,
                        std::span<int8_t, SavedNetworks::kCapacity> rssi, int8_t floorDbm = -85) {
    const size_t n = list.count();
    for (size_t i = 0; i < SavedNetworks::kCapacity; ++i) rssi[i] = kRssiUnseen;
    for (const Sighting& s : heard) {
        if (const auto i = list.find(s.ssid); i && s.rssi > rssi[*i]) rssi[*i] = s.rssi;
    }
    std::array<bool, SavedNetworks::kCapacity> placed{};
    size_t k = 0;
    for (;;) {
        int best = kRssiUnseen;
        for (size_t i = 0; i < n; ++i)
            if (!placed[i] && rssi[i] != kRssiUnseen && rssi[i] >= floorDbm && rssi[i] > best) best = rssi[i];
        if (best == kRssiUnseen) break;
        for (size_t i = 0; i < n; ++i) {
            if (!placed[i] && rssi[i] != kRssiUnseen && rssi[i] >= floorDbm && rssi[i] >= best - draft::join_near_tie_db) {
                placed[i] = true;
                order[k++] = uint8_t(i);
                break;
            }
        }
    }
    for (size_t i = 0; i < n; ++i)
        if (!placed[i]) order[k++] = uint8_t(i);
    return k;
}

}  // namespace valence::net
