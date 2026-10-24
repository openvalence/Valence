// valence-core — the transport binding contract, SPEC §13.1.
// A binding is four operations plus declared properties; everything above
// this line is transport-blind. Real adapters (WS, ESP-NOW, BLE, serial)
// live in firmware code implementing this interface — NOT in this library.
// The in-process binding (inprocess_binding.hpp) is the library's only
// concrete transport and is a first-class conformance instrument (§13.6).
#pragma once

#include <cstdint>
#include <optional>
#include <span>

#include "valence/wire/frame_buffer.hpp"

namespace valence {

// Which congestion signal this binding natively provides (SPEC §10.3, §13.1).
enum class CongestionSignal : uint8_t {
    QueueWatermark,    // TCP-backed: egress queue depth
    AckLossRate,       // ESP-NOW: ACKMASK loss percentage
    NotifyQueueDepth,  // BLE notifications
    Simulated,         // in-process binding: injected
};

// The §13.1 binding a client reached. serial and in_process are `configure`
// without exception (§12.2, H16): declare them only on the hub's own
// client-facing binding carrying the one client whose host is on the cable,
// never on an internal link (§13.0) or a transport carrying a relay's or a
// proxy's sessions (§14.1). unspecified tiers by token, like a network binding.
enum class BindingKind : uint8_t {
    unspecified,
    websocket,
    espnow,
    ble_gatt,
    serial,
    in_process,
};

struct TransportProperties {
    uint16_t mtu = uint16_t(limits::min_transport_payload) + kHeaderBytes;  // whole-frame bytes
    bool ordered = false;      // §13.1 matrix; STREAM/STATE rules assume the weakest
    bool reliable = false;
    CongestionSignal congestion = CongestionSignal::Simulated;
    BindingKind binding = BindingKind::unspecified;
};

// One endpoint of a point-to-point frame pipe. No threads: read() is a
// non-blocking poll returning at most one complete frame; callers pump it
// from their update() loop. write() takes one complete frame (header +
// payload, or the 12-byte ESTOP) and MUST NOT block; false = not accepted
// (full/closed) — the caller's class semantics decide retry vs drop (§9).
class ITransport {
public:
    virtual ~ITransport() = default;
    virtual bool open() = 0;
    virtual void close() = 0;
    virtual bool write(std::span<const std::byte> frame) = 0;
    virtual std::optional<FrameBuffer> read() = 0;
    virtual TransportProperties properties() const = 0;
};

}  // namespace valence
