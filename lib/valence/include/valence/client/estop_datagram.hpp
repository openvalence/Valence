// valence-core: RFC-053's sessionless ESTOP sender. The §5.5 frame, byte for
// byte, sent as a datagram by a sender that holds no session (a remote whose
// link is down or not yet LIVE).
//
// Constraints:
// - No socket here. `send` is the application's datagram sender and owns the
//   destination (registry udp_discovery.port, broadcast or the hub's address).
// - A sessionless sender cannot observe the latch (RFC-053 item 6), so one
//   initiation spends the whole §11.2 budget: limits::estop_repeat_max sends,
//   limits::estop_repeat_interval_ms apart, and never stops early.
// - Every initiation takes a fresh seq that all of its repeats share (§5.5).
//   The seed comes from the caller: no statics, so two senders never share
//   hidden state.
// - origin is the initiator's access tier (§5.5); `watch` with no session.
#pragma once

#include <array>
#include <cstdint>
#include <span>

#include "valence/generated/registry_constants.hpp"
#include "valence/util/serial_arithmetic.hpp"
#include "valence/wire/estop_frame.hpp"

namespace valence {

class EstopDatagramSender {
public:
    // Returns false when the datagram was not handed to the network; the
    // repeats go on either way.
    using SendFn = bool (*)(void* ctx, std::span<const std::byte> datagram);

    EstopDatagramSender(SendFn send, void* ctx, uint16_t seqSeed) : _send(send), _ctx(ctx), _seq(seqSeed) {}

    // Starts one initiation and sends its first datagram now. A call while one
    // is active starts a new initiation with a new seq.
    void initiate(uint8_t cause, uint8_t origin, uint32_t nowMs) {
        _seq = uint16_t(_seq + 1);
        if (_seq == 0) _seq = 1;
        EstopFrame f;
        f.cause = cause;
        f.origin = origin;
        f.seq = _seq;
        _len = encodeEstop(f, std::span<std::byte>(_frame));
        _attempts = 0;
        _sent = 0;
        _failed = 0;
        _active = _len > 0;
        if (_active) sendOne(nowMs);
    }

    void update(uint32_t nowMs) {
        if (!_active) return;
        if (!timeReached(nowMs, _lastMs + limits::estop_repeat_interval_ms)) return;
        sendOne(nowMs);
    }

    bool active() const { return _active; }
    uint16_t seq() const { return _seq; }
    // sent() == 0 once inactive is the loud local failure (§11.2).
    uint32_t sent() const { return _sent; }
    uint32_t failed() const { return _failed; }

private:
    void sendOne(uint32_t nowMs) {
        if (_send(_ctx, std::span<const std::byte>(_frame.data(), _len))) {
            ++_sent;
        } else {
            ++_failed;
        }
        _lastMs = nowMs;
        if (++_attempts >= limits::estop_repeat_max) _active = false;
    }

    SendFn _send;
    void* _ctx;
    std::array<std::byte, kEstopFrameBytes> _frame{};
    size_t _len = 0;
    uint16_t _seq;
    uint32_t _attempts = 0;
    uint32_t _sent = 0;
    uint32_t _failed = 0;
    uint32_t _lastMs = 0;
    bool _active = false;
};

}  // namespace valence
