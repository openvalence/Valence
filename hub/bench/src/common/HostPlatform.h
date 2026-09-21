#pragma once

// HostPlatform — desktop adapters for the Valence injected-dependency seams
// (IClock/IRandom). Verbatim in spirit with sim/valencesim's own HostPlatform.h;
// Valence Bench needs neither the 1 ms timer boost nor the precise-sleep spin
// (there is no motion planner here — the hub tick and any TUI redraw run on
// an ordinary coarse loop), so this file keeps only the clock/rng adapters.
// Constraints:
//   - SPEC §7.2: hub time is u32 microseconds since boot, WRAPPING every
//     ~71.6 min BY SPEC — nowUs() truncates a 64-bit steady_clock reading,
//     same as the firmware's EspClock truncating esp_timer_get_time().
// See: sim/valencesim/src/common/HostPlatform.h (the fuller sibling this was
// trimmed from).

#include <chrono>
#include <cstdint>
#include <random>
#include <span>

#include "valence/core/clock.hpp"
#include "valence/core/rng.hpp"

namespace bench {

class HostClock final : public valence::IClock {
public:
    HostClock() : _epoch(std::chrono::steady_clock::now()) {}

    uint32_t nowUs() const override { return uint32_t(nowUs64() & 0xFFFFFFFFull); }

    uint64_t nowUs64() const {
        auto d = std::chrono::steady_clock::now() - _epoch;
        return uint64_t(std::chrono::duration_cast<std::chrono::microseconds>(d).count());
    }

    uint32_t nowMs32() const { return uint32_t((nowUs64() / 1000ull) & 0xFFFFFFFFull); }

private:
    std::chrono::steady_clock::time_point _epoch;
};

// std::random_device is CSPRNG-backed on both target platforms (Windows UCRT:
// rand_s; Linux: /dev/urandom). Feeds session ids/boot id/nonces only.
class HostRandom final : public valence::IRandom {
public:
    uint32_t nextU32() override { return _rd(); }

    void fill(std::span<std::byte> out) override {
        for (auto& b : out) b = std::byte(_rd() & 0xFF);
    }

private:
    std::random_device _rd;
};

}  // namespace bench
