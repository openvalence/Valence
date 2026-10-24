// valence-core: injected ALLOCATOR for the few buffers too large to hold
// inline (today: the Client's catalog reassembly, sized per transfer up to
// limits::catalog_max_bytes). Same family as IClock, IRandom and ICrypto: the
// application supplies one where the default does not fit its memory map.
//
// Constraints:
// - allocate() returns nullptr on failure and never throws; callers turn a
//   nullptr into a refusal (§8.4 BLOB_REFUSED), never into a crash.
// - The returned block needs only alignof(std::max_align_t) and is never
//   handed to DMA, so PSRAM is fine (an ESP32-S3/P4 passes
//   heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)).
// - The allocator must outlive every object it serves.
#pragma once

#include <cstddef>
#include <cstdlib>

namespace valence {

class IAllocator {
public:
    virtual ~IAllocator() = default;
    virtual void* allocate(size_t bytes) = 0;
    virtual void deallocate(void* p, size_t bytes) = 0;
};

class HeapAllocator final : public IAllocator {
public:
    void* allocate(size_t bytes) override { return std::malloc(bytes); }
    void deallocate(void* p, size_t) override { std::free(p); }
};

inline IAllocator& defaultAllocator() {
    static HeapAllocator a;
    return a;
}

}  // namespace valence
