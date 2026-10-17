#pragma once

// ValenceBenchWsTransport / ValenceBenchWsPort -- the host WebSocket binding
// for Valence Bench and Nucleus Neutrino (both compile this file).
// Constraints:
//   - IXWebSocket runs ONE THREAD PER CONNECTION; the hub is strictly
//     single-threaded (the owner's tick() pumps hub.update()). Connection
//     threads only ever (a) push inbound frames into a per-slot
//     mutex-guarded RX ring and (b) flip open/close/proof-of-life flags; the
//     hub thread consumes them in loop(). Nothing but the hub thread may ever
//     call hub.attach/detachTransport or ITransport::read()/write().
//   - write() never blocks (ITransport's contract). It needs IXWebSocket's
//     server sends in non-blocking mode, which cmake/PatchIXWebSocket.cmake
//     provides; upstream's blocking server send held the hub thread on a
//     peer that stopped reading (bd val-ni0). bufferedAmount() over threshold
//     (or a failed send) MUTES the client so every later write() returns false
//     instantly. Mute clears only once the backlog drains below half the
//     threshold, never on inbound traffic: a peer that PINGs but never reads
//     is still wedged. Muted continuously > kStallEvictMs disconnects it.
//   - A peer that goes dark without a FIN or RST is reaped after kIdleReapMs
//     of inbound silence; nothing else frees its slot.
//   - One close request per connection: a repeat would only re-log.

#include <cstdint>
#include <memory>
#include <mutex>
#include <optional>
#include <span>
#include <string>
#include <unordered_map>

#include <ixwebsocket/IXWebSocketServer.h>

#include "valence/hub/hub.hpp"
#include "valence/transport/transport.hpp"
#include "valence/wire/frame_buffer.hpp"

#include "common/SessionLog.h"

namespace bench {

class ValenceBenchWsTransport final : public valence::ITransport {
public:
    static constexpr uint8_t kRxRingDepth = 8;
    static constexpr uint32_t kStallEvictMs = 2000;
    static constexpr size_t kMuteBufferedBytes = 64 * 1024;
    // Ten missed proof-of-life PINGs, the P4 port's (ValenceWsPort.h) value.
    static constexpr uint32_t kIdleReapMs = 10 * valence::limits::ping_interval_idle_ms;

    // ---- ITransport (hub thread only) ---------------------------------------
    bool open() override { return true; }
    void close() override;
    bool write(std::span<const std::byte> frame) override;
    std::optional<valence::FrameBuffer> read() override;
    valence::TransportProperties properties() const override {
        valence::TransportProperties p;
        p.mtu = uint16_t(valence::kFrameBufferCapacity);
        p.ordered = true;
        p.reliable = true;
        p.congestion = valence::CongestionSignal::QueueWatermark;
        return p;
    }

    // ---- Connection-thread side (marshaling producers) ----------------------
    void onOpen(ix::WebSocket* ws, const std::string& peer);
    void onClose();
    void pushRx(const void* data, size_t len);
    void noteRx();  // proof of life: any inbound frame, control frames included

    // ---- Hub-thread bookkeeping ---------------------------------------------
    bool consumeOpenEvent();
    bool consumeCloseEvent();
    bool inUse() const;
    void reap();
    // False when a close was already requested for this connection.
    bool requestClose();
    // True once inbound silence has run past kIdleReapMs.
    bool idleOut(uint32_t nowMs);
    // Clears a drained mute; true once muted continuously past kStallEvictMs.
    bool stalledOut(uint32_t nowMs);

    bool muted() const { return _muted; }
    uint32_t rxDrops() const { return _rxDrops; }
    std::string peer() const;
    void setNowMsSource(const uint32_t* nowMs) { _nowMs = nowMs; }

private:
    void muteLocked();  // _m held

    mutable std::mutex _m;
    ix::WebSocket* _ws = nullptr;
    std::string _peer;
    bool _inUse = false;
    bool _openEvt = false;
    bool _closeEvt = false;
    bool _closeHeld = false;  // the close waited one hub update for pending frames
    bool _closeRequested = false;
    bool _rxSeen = false;      // connection thread sets, hub thread consumes
    uint32_t _lastRxMs = 0;    // hub thread only

    valence::FrameBuffer _rx[kRxRingDepth]{};
    uint8_t _rxHead = 0, _rxTail = 0, _rxCount = 0;
    uint32_t _rxDrops = 0;

    bool _muted = false;
    bool _sendFailed = false;  // the socket refused a send: never unmuted
    uint32_t _mutedSinceMs = 0;
    const uint32_t* _nowMs = nullptr;
};

class ValenceBenchWsPort {
public:
    static constexpr uint8_t kSlots = valence::kHubMaxSessions + 1;

    // bindHost: the listen address; "127.0.0.1" keeps the port off the LAN.
    bool begin(valence::Hub* hub, uint16_t port, SessionLog* log, const std::string& bindHost = "0.0.0.0");
    void stop();

    // Hub-thread pump: consume open/close events (attach/detach), sweep stalls.
    void loop(uint32_t nowMs);

    struct SlotInfo {
        bool inUse = false;
        std::string peer;
        bool muted = false;
        uint32_t rxDrops = 0;
    };
    SlotInfo slotInfo(uint8_t i) const;
    void kick(uint8_t i);  // fault injection: hard-close one client

private:
    void onMessage(std::shared_ptr<ix::ConnectionState> state, ix::WebSocket& ws,
                   const ix::WebSocketMessagePtr& msg);

    std::unique_ptr<ix::WebSocketServer> _server;
    valence::Hub* _hub = nullptr;
    SessionLog* _log = nullptr;
    ValenceBenchWsTransport _slots[kSlots];
    bool _attached[kSlots] = {};
    uint32_t _nowMs = 0;

    std::mutex _mapM;
    std::unordered_map<std::string, uint8_t> _slotById;
};

}  // namespace bench
