#pragma once

// ValenceBenchWsTransport / ValenceBenchWsPort — the host WebSocket binding for the
// Valence Bench hub. Copied from sim/valencesim's own WsServerPort.h/.cpp (same
// IXWebSocket-per-connection-thread marshaling pattern, same backpressure
// doctrine) rather than shared, because the two sims are separate CMake
// targets with no common host-only library between them yet.
// Constraints:
//   - IXWebSocket runs ONE THREAD PER CONNECTION; the hub is strictly
//     single-threaded (the owner's tick() pumps hub.update()). Connection
//     threads only ever (a) push inbound frames into a per-slot
//     mutex-guarded RX ring and (b) flip open/close event flags; the hub
//     thread consumes both in loop(). Nothing but the hub thread may ever
//     call hub.attach/detachTransport or ITransport::read()/write().
//   - write() never blocks: bufferedAmount() over threshold (or a failed
//     send) MUTES the client so every later write() returns false instantly;
//     mute clears on any inbound frame; muted continuously > kStallEvictMs
//     disconnects the client.
// See: sim/valencesim/src/net/WsServerPort.h (the sibling this was copied from;
// read its longer file-header comment for the full threading rationale).

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

    // ---- Hub-thread bookkeeping ---------------------------------------------
    bool consumeOpenEvent();
    bool consumeCloseEvent();
    bool inUse() const;
    void reap();
    void requestClose();

    bool muted() const { return _muted; }
    uint32_t mutedSinceMs() const { return _mutedSinceMs; }
    uint32_t rxDrops() const { return _rxDrops; }
    std::string peer() const;
    void setNowMsSource(const uint32_t* nowMs) { _nowMs = nowMs; }

private:
    mutable std::mutex _m;
    ix::WebSocket* _ws = nullptr;
    std::string _peer;
    bool _inUse = false;
    bool _openEvt = false;
    bool _closeEvt = false;

    valence::FrameBuffer _rx[kRxRingDepth]{};
    uint8_t _rxHead = 0, _rxTail = 0, _rxCount = 0;
    uint32_t _rxDrops = 0;

    bool _muted = false;
    uint32_t _mutedSinceMs = 0;
    const uint32_t* _nowMs = nullptr;
};

class ValenceBenchWsPort {
public:
    static constexpr uint8_t kSlots = valence::kHubMaxSessions + 1;

    bool begin(valence::Hub* hub, uint16_t port, SessionLog* log);
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
