// =============================================================================
// LiveWireTest — exercises the REAL ValenceConnect.cs protocol classes (HubClient,
// ValenceWire, CborWriter/Reader, MdnsDiscovery, WelcomeInfo) against a live
// Nucleus device over its actual WebSocket. This is NOT a codec
// self-test (see WireSelfTest.cs, which deliberately re-implements the codec
// to golden-byte-check it) — it links and drives the plugin's own classes,
// unmodified, exactly as ValenceConnect.cs's SessionAsync does.
//
// The DEFAULT run never sends an INTENT frame or any motion command besides the
// STREAM bundles described below, and is GET-only against the device's HTTP API.
// Two extra modes have their own contracts, stated at their own entry points:
//   --lag          live check of the plugin's LagMeter. DELIBERATELY MOVES THE
//                  MACHINE (force-home + window config-set + 14 s of sine).
//   --lag-selftest the LagMeter's math against a known shift. No hardware, no
//                  network, no socket opened at all.
//
// Run:  dotnet run --project clients/mfp/LiveWireTest.csproj [ip] [port]
// Exit 0 only if every hard PASS criterion below is met.
//
// VERIFICATION DEBT (plugin v0.4.0 — RFC-013 honest rate/burst + RFC-030
// curve_family on the 0x2101 wish, was 0x0085 pre-RFC-047): a bench re-run is REQUIRED before this
// plugin version is considered verified — run this test TWICE BACK-TO-BACK
// WITHOUT rebooting the device in between, per the ownership-release
// regression pattern (the fw 2.1.44 teardown-leak bug was invisible to every
// single-run pass because deploys rebooted the device between runs).
// =============================================================================
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using NLog;

internal static class LiveWireTest
{
    private static readonly Logger Log = LogManager.GetCurrentClassLogger();

    private static async Task<int> Main(string[] args)
    {
        // --segments selects the 0x2101 timed-segment path (was 0x0085); positional args
        // (ip, port) are read ignoring any --flags.
        bool segments = Array.Exists(args, a => a == "--segments");
        var pos = Array.FindAll(args, a => !a.StartsWith("--"));
        string ip = pos.Length > 0 ? pos[0] : "192.168.1.229";
        int port = pos.Length > 1 ? int.Parse(pos[1]) : 82;
        string baseUrl = $"http://{ip}";

        // --lag is a DIFFERENT test with a different contract: it deliberately
        // MOVES the machine, because a lag meter pointed at a machine that is
        // not moving measures nothing. It therefore shares neither the wire-
        // shape assertions nor the unhomed safety gate below, and lives apart.
        if (Array.Exists(args, a => a == "--lag-selftest"))
            return LagSelfTest();
        if (Array.Exists(args, a => a == "--lag"))
            return await LagModeAsync(ip, port);

        Console.WriteLine("=============================================================");
        Console.WriteLine($" Valence LiveWireTest — target {ip}:{port}  mode={(segments ? "SEGMENTS (0x2101)" : "SAMPLES (0x2100)")}");
        Console.WriteLine("=============================================================");

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

        // ---- SAFETY GATE ----------------------------------------------------
        // On real hardware: /api/status must say unhomed + not e-stopped, or we
        // refuse to open a socket at all. On valencesim there is no /api/status
        // (its HTTP facade is capabilities + kinetic only) and nothing
        // physical to move, so `sim: true` in /api/capabilities is an explicit
        // waiver. An endpoint we cannot read on a machine that is NOT a
        // declared sim is an ABORT — "unknown machine state" is never a pass.
        bool isSim = false;
        try
        {
            var caps = JObject.Parse(await http.GetStringAsync($"{baseUrl}/api/capabilities"));
            isSim = caps.Value<bool?>("sim") ?? false;
            Console.WriteLine($"[gate] target: fw={caps.Value<string>("fw_version")} sim={isSim}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[gate] /api/capabilities unreadable ({ex.Message})");
        }

        JObject status = null;
        try { status = JObject.Parse(await http.GetStringAsync($"{baseUrl}/api/status")); }
        catch (Exception ex)
        {
            if (!isSim)
            {
                Console.WriteLine($"ABORT: no /api/status at {baseUrl} ({ex.Message}) and the target does not declare itself a simulator — refusing to stream at an unknown machine state.");
                return 3;
            }
            Console.WriteLine("[gate] no /api/status (valencesim) — proceeding on the declared-simulator waiver.");
        }

        if (status != null)
        {
            bool homed = status.Value<bool?>("homed") ?? false;
            bool estopped = status.Value<bool?>("estopped") ?? false;
            Console.WriteLine($"[gate] homed={homed} estopped={estopped}");
            if (homed)
            {
                Console.WriteLine("ABORT: machine is HOMED — streamed motion would actually move it. Refusing to open a WebSocket.");
                return 3;
            }
            if (estopped)
            {
                Console.WriteLine("ABORT: machine is E-STOPPED. Refusing to open a WebSocket.");
                return 3;
            }
            Console.WriteLine("[gate] PASS — unhomed, not estopped. Streamed motion will be dropped at the firmware HOMED gate (expected & correct).");
        }
        Console.WriteLine();

        // ---- Baseline /api/kinetic sync counters --------------------------
        var (baseBundles, baseSamples, baseEnqueued, baseDropped) = await ReadSyncCounters(http, baseUrl);
        Console.WriteLine("[baseline] /api/kinetic sync block:");
        Console.WriteLine($"    bundles={baseBundles} samples={baseSamples} enqueued={baseEnqueued} dropped={baseDropped}");
        Console.WriteLine();

        // ---- Discovery test ----------------------------------------------------
        Console.WriteLine("[discovery] running MdnsDiscovery.DiscoverAsync (2s window)...");
        bool discoveryFound = false;
        try
        {
            var found = await MdnsDiscovery.DiscoverAsync(TimeSpan.FromSeconds(2), Log, CancellationToken.None);
            if (found.Count == 0)
            {
                Console.WriteLine("[discovery] WARN: no devices found (multicast can be flaky on this network/host — not a hard fail).");
            }
            foreach (var d in found)
            {
                Console.WriteLine($"    found: {d.InstanceName}  ip={d.Ip} port={d.Port} fw={d.Fw ?? "(none)"}");
                if (d.Ip == ip && d.Port == port)
                    discoveryFound = true;
            }
            if (found.Count > 0 && !discoveryFound)
                Console.WriteLine($"[discovery] WARN: found device(s), but none matched {ip}:{port}.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[discovery] WARN: discovery threw: {ex.Message}");
        }
        Console.WriteLine($"[discovery] result: {(discoveryFound ? "FOUND (matches target)" : "NOT CONFIRMED (soft — see warnings above)")}");
        Console.WriteLine();

        // ---- Credential (fw 2.1.59+ enforces authorization) ------------------
        // A tokenless HELLO is granted `watch` tier: safety/telemetry still flow
        // but the motion-input/motion-segment publish wish is refused, which is
        // exactly why every grant assertion below used to read NaN. Mirrors the
        // self-serve rung of the plugin's own AcquireTokenAsync ladder
        // (ValenceConnect.cs) — this harness has no PIN box, so it mints fresh every
        // run instead of trying the paired-token rung first.
        byte[] token16 = await MintUiTokenAsync(http, baseUrl);
        Console.WriteLine(token16 != null
            ? "[auth] /uitoken minted — presenting in HELLO for control tier"
            : "[auth] /uitoken NOT minted — HELLO will be tokenless (watch tier; grant checks below WILL fail)");
        Console.WriteLine();

        // ---- Session test --------------------------------------------------
        var instanceId = new byte[ValenceWire.InstanceIdBytes];
        RandomNumberGenerator.Fill(instanceId);

        using var sessionCts = new CancellationTokenSource(TimeSpan.FromSeconds(60));
        var token = sessionCts.Token;

        using var ws = new ClientWebSocket();
        ws.Options.AddSubProtocol(ValenceWire.WsSubprotocol);
        var uri = new Uri($"ws://{ip}:{port}/");
        Console.WriteLine($"[ws] connecting to {uri} (subprotocol {ValenceWire.WsSubprotocol})...");
        await ws.ConnectAsync(uri, token);
        Console.WriteLine("[ws] connected.");

        var client = new HubClient(ws, instanceId, Log);

        // §6.2 subscription wishes ride in HELLO now (RFC-006). This is the
        // byte shape WireSelfTest's HELLO goldens pin.
        var subWishes = new (ushort ch, double rate, byte prio)[]
        {
            (ValenceWire.ChSafety, 0.0, ValenceWire.PriorityCritical),
            (ValenceWire.ChMotion, 20.0, ValenceWire.PriorityElevated),
        };

        WelcomeInfo welcome;
        double segGranted = double.NaN;
        if (segments)
        {
            Console.WriteLine("[hello] subs safety+motion; wishing publish on motion-input (0x2100) @ 50 Hz AND motion-segment (0x2101) @ 10 Hz...");
            welcome = await client.HelloAsync("mfp", "LiveWireTest",
                new (ushort ch, double rate)[] { (ValenceWire.ChMotionInput, 50.0), (ValenceWire.ChMotionSegment, 10.0) },
                token16, token, subWishes);
            segGranted = welcome.GrantedPublishRate(ValenceWire.ChMotionSegment);
        }
        else
        {
            Console.WriteLine("[hello] subs safety+motion; wishing publish on motion-input (0x2100) @ 50 Hz...");
            welcome = await client.HelloAsync("mfp", "LiveWireTest",
                new (ushort ch, double rate)[] { (ValenceWire.ChMotionInput, 50.0) },
                token16, token, subWishes);
        }
        double granted = welcome.GrantedPublishRate(ValenceWire.ChMotionInput);
        Console.WriteLine($"[welcome] session_id={welcome.SessionId} boot_id=0x{welcome.BootId:X8} etag={ValenceCatalog.Hex(welcome.CatalogEtag)} granted motion-input={granted:F1} Hz (wished 50.0)"
            + (segments ? $" motion-segment={segGranted:F1} Hz (wished 10.0)" : ""));
        Console.WriteLine();

        // ---- §8.4 / RFC-015 READINESS GATE ----------------------------------
        // No cached etag here (a fresh process every run), so this always takes
        // the FETCH path: BLOB_REQ -> BLOB_CHUNK reassembly -> verify the
        // SHA-256 locally -> CATALOG_READY. Until that lands the hub emits no
        // data-plane frame and NACKs every intent NOT_READY, so "STATE frames
        // received > 0" below is itself the proof the gate opened.
        Console.WriteLine("[ready] BLOB_REQ namespace 0 (catalog)...");
        var catalogBytes = await client.FetchCatalogAsync(token);
        bool catalogOk = catalogBytes != null;
        bool etagVerified = false;
        ValenceCatalog catalog = null;
        if (!catalogOk)
        {
            Console.WriteLine("[ready] FAIL: catalog transfer produced nothing.");
        }
        else
        {
            var digest = ValenceCatalog.Etag(catalogBytes);
            etagVerified = ValenceCatalog.BytesEqual(digest, welcome.CatalogEtag);
            catalog = ValenceCatalog.Decode(catalogBytes);
            Console.WriteLine($"[ready] catalog {catalogBytes.Length} B, sha256[:8]={ValenceCatalog.Hex(digest)} "
                + (etagVerified ? "VERIFIES against WELCOME" : $"MISMATCH (WELCOME said {ValenceCatalog.Hex(welcome.CatalogEtag)})")
                + $", decoded {catalog?.Entries.Count ?? 0} channels / {catalog?.RoleCount ?? 0} roles");
            await client.SendCatalogReadyAsync(digest, token);
            Console.WriteLine($"[ready] CATALOG_READY sent — data plane + control plane open.");
        }
        Console.WriteLine();

        // ---- RFC-006(b) ROLE LOOKUP -----------------------------------------
        // The point of the whole exercise: find the kinematic limits WITHOUT
        // knowing this device's channel numbering. Nothing below names 0x0081.
        var roleNames = new[]
        {
            ValenceWire.RoleWindowMin, ValenceWire.RoleWindowMax,
            ValenceWire.RoleLimitInputSpeed, ValenceWire.RoleLimitInputAccel, ValenceWire.RoleLimitInputJerk,
        };
        var locators = new Dictionary<string, ValenceCatalog.RoleLocator>();
        Console.WriteLine("[roles] locating kinematic field_roles in the fetched catalog:");
        foreach (var rn in roleNames)
        {
            var loc = catalog?.LocateRole(rn);
            if (loc != null) locators[rn] = loc;
            Console.WriteLine(loc == null
                ? $"    {rn,-20} -> NOT ADVERTISED"
                : $"    {rn,-20} -> channel 0x{loc.ChannelId:X4} field '{loc.Field.Name}' @byte {loc.Field.Offset} "
                  + $"({loc.Field.Unit}) {(loc.Writable ? $"writable via 0x{loc.SettingChannel:X4} key {loc.SettingKey}" : "read-only")}");
        }
        int rolesFound = locators.Count;
        Console.WriteLine();

        // Mid-session SUBSCRIBE to whatever channel(s) those roles landed on.
        var roleChannels = new List<ushort>();
        foreach (var loc in locators.Values)
            if (loc.ChannelId != ValenceWire.ChSafety && loc.ChannelId != ValenceWire.ChMotion && !roleChannels.Contains(loc.ChannelId))
                roleChannels.Add(loc.ChannelId);
        if (roleChannels.Count > 0)
        {
            Console.WriteLine($"[subscribe] role-located channel(s): {string.Join(", ", roleChannels.ConvertAll(c => $"0x{c:X4}"))} (on-change, normal)");
            await client.SubscribeAsync(roleChannels.ConvertAll(c => (c, 0.0, ValenceWire.PriorityNormal)), token);
        }

        int nackCount = 0;
        int stateCount = 0;
        var stateByChannel = new Dictionary<ushort, int>();
        var nackLog = new List<(ushort code, ushort channel)>();
        var roleValues = new Dictionary<string, double>();

        void OnNack(HubClient.NackInfo n)
        {
            nackCount++;
            nackLog.Add((n.Code, n.Channel));
            Console.WriteLine($"    [recv] NACK {n.Name} channel=0x{n.Channel:X4} intent_seq={n.IntentSeq?.ToString() ?? "-"}");
        }

        void OnState(ushort channel, byte[] payload)
        {
            stateCount++;
            stateByChannel.TryGetValue(channel, out var c);
            stateByChannel[channel] = c + 1;
            // Decode role values off the packed snapshot, using the layout the
            // hub itself published — no hardcoded offsets anywhere.
            foreach (var kv in locators)
            {
                if (kv.Value.ChannelId != channel) continue;
                double v = ValenceCatalog.ReadField(payload, kv.Value.Field);
                if (!double.IsNaN(v)) roleValues[kv.Key] = v;
            }
        }

        var recvTask = client.ReceiveLoopAsync(OnNack, OnState, token);

        // ---- CLOCK sync (mirrors ValenceConnect.cs's ResyncClock: several
        // exchanges, keep the best-RTT offset) ---------------------------------
        Console.WriteLine("[clock] running 5-exchange sync (keep best RTT)...");
        long bestRtt = long.MaxValue;
        long bestOffset = 0;
        for (int i = 0; i < 5 && !token.IsCancellationRequested; i++)
        {
            var r = await client.ClockExchangeAsync(token);
            if (r == null) continue;
            var (offset, rtt) = r.Value;
            Console.WriteLine($"    exchange {i}: offset={offset} us rtt={rtt} us");
            if (rtt < bestRtt) { bestRtt = rtt; bestOffset = offset; }
        }
        bool haveClock = bestRtt != long.MaxValue;
        if (haveClock)
        {
            client.SetClockOffset(bestOffset);
            Console.WriteLine($"[clock] best: offset={bestOffset} us rtt={bestRtt} us");
        }
        else
        {
            Console.WriteLine("[clock] FAIL: no CLOCK exchange completed.");
        }
        Console.WriteLine();

        // ---- Stroke-window INTENT round trip (SIMULATOR ONLY) ---------------
        // This is the only automated proof that the plugin's new window control
        // DRIVES something rather than merely rendering. It is gated hard on
        // `isSim`: writing config to somebody's real machine from a test
        // harness is not this program's business, and the Home intent is not
        // exercised anywhere for the same reason (it moves a physical axis).
        //
        // What it proves: (1) an INTENT built against the ROLE'S paired
        // settingChannel + settingKey is accepted, (2) the ECHO's `applied` map
        // carries the POST-CLAMP values the ground-truth doctrine requires,
        // and (3) header.seq == intent_id, so a NACK's intent_seq would name
        // the same number the ECHO does (RFC-001).
        bool intentTested = false, intentEchoed = false, intentRestored = false;
        var wMinLoc = locators.TryGetValue(ValenceWire.RoleWindowMin, out var wl) ? wl : null;
        var wMaxLoc = locators.TryGetValue(ValenceWire.RoleWindowMax, out var wh) ? wh : null;
        if (isSim && wMinLoc != null && wMaxLoc != null && wMinLoc.Writable && wMaxLoc.Writable &&
            roleValues.ContainsKey(ValenceWire.RoleWindowMin) && roleValues.ContainsKey(ValenceWire.RoleWindowMax))
        {
            double origMin = roleValues[ValenceWire.RoleWindowMin];
            double origMax = roleValues[ValenceWire.RoleWindowMax];
            double tryMin = origMin + 10.0;
            double tryMax = origMax - 10.0;

            var echoes = new List<HubClient.EchoInfo>();
            void OnEcho(HubClient.EchoInfo e)
            {
                echoes.Add(e);
                string ap = "-";
                if (e.TryGetApplied(wMinLoc.SettingKey.Value, out var am) &&
                    e.TryGetApplied(wMaxLoc.SettingKey.Value, out var ax))
                    ap = $"min={am:F1} max={ax:F1}";
                Console.WriteLine($"    [recv] ECHO channel=0x{e.Channel:X4} intent_id={e.IntentId} cfg_gen={e.CfgGen} applied {ap}");
            }
            client.SetEchoHandler(OnEcho);

            Console.WriteLine($"[intent] window {origMin:F1}/{origMax:F1} -> {tryMin:F1}/{tryMax:F1} "
                + $"via channel 0x{wMinLoc.SettingChannel:X4} keys {wMinLoc.SettingKey}/{wMaxLoc.SettingKey} (role-resolved, intent_id=101)");
            await client.SendIntentAsync(wMinLoc.SettingChannel.Value, 101, new (int, byte[])[]
            {
                (wMinLoc.SettingKey.Value, ValenceWire.CborF32(tryMin)),
                (wMaxLoc.SettingKey.Value, ValenceWire.CborF32(tryMax)),
            }, token);
            intentTested = true;
            await Task.Delay(600, token);
            intentEchoed = echoes.Exists(e => e.IntentId == 101);

            Console.WriteLine($"[intent] restoring window {origMin:F1}/{origMax:F1} (intent_id=102)");
            await client.SendIntentAsync(wMinLoc.SettingChannel.Value, 102, new (int, byte[])[]
            {
                (wMinLoc.SettingKey.Value, ValenceWire.CborF32(origMin)),
                (wMaxLoc.SettingKey.Value, ValenceWire.CborF32(origMax)),
            }, token);
            await Task.Delay(600, token);
            intentRestored = echoes.Exists(e => e.IntentId == 102);
            client.SetEchoHandler(null);
            Console.WriteLine();
        }
        else if (!isSim)
        {
            Console.WriteLine("[intent] SKIPPED — target is not a declared simulator; this harness does not write config to real hardware.");
            Console.WriteLine();
        }

        // ---- Stream test -----------------------------------------------------
        long sends = 0;
        if (segments)
        {
            // 5 timed segments over ~5 s, alternating target 0.3/0.7, duration
            // 900 ms each, with a PING keepalive every 400 ms of silence between
            // them (segments are sparse — without PING the hub's 600 ms deadman
            // would fire). end_vel alternates sentinel / rest to exercise both.
            Console.WriteLine("[stream] sending 5 segments over ~5 s (target 0.3/0.7, dur 900 ms) with 400 ms PING keepalive...");
            var sw2 = Stopwatch.StartNew();
            double lastSendMs = 0;
            for (int k = 0; k < 5 && !token.IsCancellationRequested; k++)
            {
                double target = (k % 2 == 0) ? 0.3 : 0.7;
                bool sentinel = (k % 2 == 0);                 // even: no end-vel; odd: rest at target
                var seg = new SegmentSample(target, 900, sentinel ? 0.0 : 0.0, sentinel);
                await client.SendSegmentSampleAsync(client.HubNowUs(), seg, token);
                sends++;
                lastSendMs = sw2.Elapsed.TotalMilliseconds;
                Console.WriteLine($"    segment {k}: target={target:F2} dur=900ms end_vel={(sentinel ? "SENTINEL" : "0 (rest)")}");

                // hold ~1 s until the next segment, PINGing when silent > 400 ms
                double until = lastSendMs + 1000;
                while (sw2.Elapsed.TotalMilliseconds < until && !token.IsCancellationRequested)
                {
                    double nowMs = sw2.Elapsed.TotalMilliseconds;
                    if (nowMs - lastSendMs >= 400)
                    {
                        await client.SendPingAsync(token);
                        lastSendMs = nowMs;
                        Console.WriteLine("    ping (keepalive)");
                    }
                    await Task.Delay(50, token);
                }
            }
            Console.WriteLine($"[stream] done: segments={sends} (expected 5)");
        }
        else
        {
            // 5 s @ granted rate, analytic sine + derivative.
            double rateHz = granted > 0 ? granted : 50.0;
            double periodMs = 1000.0 / rateHz;
            const double durationS = 5.0;
            const double freqHz = 0.5;
            const double amp = 0.2;
            const double center = 0.5;

            Console.WriteLine($"[stream] sending {durationS:F0}s @ {rateHz:F1} Hz (target=0.5+0.2*sin(2*pi*0.5*t))...");
            var sw = Stopwatch.StartNew();
            double nextMs = 0;
            while (sw.Elapsed.TotalSeconds < durationS && !token.IsCancellationRequested)
            {
                double nowMs = sw.Elapsed.TotalMilliseconds;
                if (nowMs < nextMs)
                {
                    int sleep = (int)Math.Max(0, Math.Min(nextMs - nowMs, 5));
                    await Task.Delay(sleep, token);
                    continue;
                }
                nextMs += periodMs;
                if (nextMs < nowMs) nextMs = nowMs + periodMs;

                double t = sw.Elapsed.TotalSeconds;
                double w = 2 * Math.PI * freqHz;
                double target = center + amp * Math.Sin(w * t);
                double vel = amp * w * Math.Cos(w * t);

                await client.SendStreamSampleAsync(client.HubNowUs(), target, vel, token);
                sends++;
            }
            Console.WriteLine($"[stream] done: sends={sends} (expected ~{(int)Math.Round(rateHz * durationS)})");
        }
        Console.WriteLine();

        // ---- Drain trailing frames, then close cleanly -----------------------
        await Task.Delay(400, CancellationToken.None);
        sessionCts.Cancel();
        try { await recvTask; } catch (OperationCanceledException) { }

        if (ws.State == WebSocketState.Open)
        {
            try { await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "LiveWireTest done", CancellationToken.None); }
            catch { /* best-effort */ }
        }
        Console.WriteLine($"[ws] closed. states_received={stateCount} nacks={nackCount}");
        foreach (var kv in stateByChannel)
            Console.WriteLine($"    STATE channel=0x{kv.Key:X4} count={kv.Value}");
        Console.WriteLine();

        // ---- What the role lookup actually READ off the wire ------------------
        Console.WriteLine("[roles] values decoded from STATE via the catalog layout:");
        foreach (var rn in roleNames)
        {
            string unit = locators.TryGetValue(rn, out var l) ? l.Field.Unit : "";
            Console.WriteLine(roleValues.TryGetValue(rn, out var v)
                ? $"    {rn,-20} = {v:N2} {unit}"
                : $"    {rn,-20} = (no value seen)");
        }
        int roleValuesRead = roleValues.Count;
        Console.WriteLine();

        // ---- After counters + diff --------------------------------------------
        var (afterBundles, afterSamples, afterEnqueued, afterDropped) = await ReadSyncCounters(http, baseUrl);
        long dBundles = afterBundles - baseBundles;
        long dSamples = afterSamples - baseSamples;
        long dEnqueued = afterEnqueued - baseEnqueued;
        long dDropped = afterDropped - baseDropped;

        Console.WriteLine("[after] /api/kinetic sync block:");
        Console.WriteLine($"    bundles={afterBundles} samples={afterSamples} enqueued={afterEnqueued} dropped={afterDropped}");
        Console.WriteLine($"[diff]  bundles={dBundles} samples={dSamples} enqueued={dEnqueued} dropped={dDropped}");
        Console.WriteLine();

        // ---- PASS/FAIL table ----------------------------------------------------
        var checks = new List<(string name, bool pass, string detail)>
        {
            ("control-tier credential presented (/uitoken)", token16 != null, token16 != null ? "minted" : "NOT minted — HELLO went tokenless"),
            ("granted motion-input rate == 50 Hz", Math.Abs(granted - 50.0) < 0.01, $"granted={granted:F2}"),
            ("catalog fetched over BLOB_REQ/BLOB_CHUNK", catalogOk, catalogOk ? $"{catalogBytes.Length} B" : "no bytes"),
            ("catalog sha256[:8] == WELCOME catalog_etag", etagVerified, ValenceCatalog.Hex(welcome.CatalogEtag)),
            ("catalog decodes to >0 channels", (catalog?.Entries.Count ?? 0) > 0, $"channels={catalog?.Entries.Count ?? 0}"),
            ("all 5 kinematic roles located by role, not channel", rolesFound == 5, $"found={rolesFound}/5"),
            ("role values decoded from STATE", roleValuesRead == rolesFound, $"read={roleValuesRead}/{rolesFound}"),
            ("window INTENT ECHOed (sim only)", !intentTested || intentEchoed, intentTested ? $"echoed={intentEchoed}" : "skipped (not a sim)"),
            ("window restored by 2nd INTENT (sim only)", !intentTested || intentRestored, intentTested ? $"echoed={intentRestored}" : "skipped (not a sim)"),
            ("CLOCK rtt < 200000 us", haveClock && bestRtt < 200000, haveClock ? $"rtt={bestRtt} us" : "no exchange completed"),
            ("bundles delta == sends (zero wire loss)", dBundles == sends, $"delta={dBundles} sends={sends}"),
            ("samples delta == sends", dSamples == sends, $"delta={dSamples} sends={sends}"),
            ("enqueued delta == 0", dEnqueued == 0, $"delta={dEnqueued}"),
            ("dropped delta == sends (unhomed HOMED-gate drop)", dDropped == sends, $"delta={dDropped} sends={sends}"),
            ("STATE frames received > 0", stateCount > 0, $"count={stateCount}"),
            ("NACKs received == 0", nackCount == 0, $"count={nackCount}"),
        };
        if (segments)
            checks.Insert(1, ("granted motion-segment rate == 10 Hz", Math.Abs(segGranted - 10.0) < 0.01, $"granted={segGranted:F2}"));

        Console.WriteLine("=============================================================");
        Console.WriteLine(" PASS/FAIL");
        Console.WriteLine("=============================================================");
        bool allPass = true;
        foreach (var (name, pass, detail) in checks)
        {
            Console.WriteLine($"  [{(pass ? "PASS" : "FAIL")}] {name}  ({detail})");
            if (!pass) allPass = false;
        }
        Console.WriteLine();
        Console.WriteLine(allPass ? "RESULT: ALL HARD CRITERIA PASS" : "RESULT: FAILURES ABOVE");
        return allPass ? 0 : 1;
    }

    // --lag-selftest : the LagMeter's correlation math against a KNOWN shift and
    // gain, with no hardware and no network. Exists because the live check
    // needs a machine, and a meter nobody can test offline is a meter nobody
    // re-tests after touching it.
    private static int LagSelfTest()
    {
        const double truthMs = 40.0;   // rendered trails intended by this much
        const double truthGain = 0.80;
        var meter = new LagMeter();
        uint t0 = HubClient.ClientNowUs();
        // 6 s of a 0.8 Hz sine: intended at its own time, rendered delayed and
        // scaled about the same mean. 10 ms steps on both sides.
        for (int ms = 0; ms <= 6000; ms += 10)
        {
            double s = 0.5 + 0.35 * Math.Sin(2.0 * Math.PI * 0.8 * (ms / 1000.0));
            meter.NoteIntent(unchecked(t0 + (uint)(ms * 1000)), s);
            double d = 0.5 + 0.35 * truthGain * Math.Sin(2.0 * Math.PI * 0.8 * ((ms - truthMs) / 1000.0));
            meter.NoteRendered(unchecked(t0 + (uint)(ms * 1000)), d);
        }
        // Two updates: the first seeds the EMA, the second confirms it settles.
        meter.Update(unchecked(t0 + 6_000_000));
        meter.Update(unchecked(t0 + 7_100_000));
        Console.WriteLine($"[lag-selftest] truth {truthMs:+0;-0} ms gain {truthGain:F2}  ->  meter {meter.Summary}");
        bool okLag = !meter.Idle && Math.Abs(meter.LagMs - truthMs) <= LagMeter.ShiftStepMs;
        bool okGain = Math.Abs(meter.AmpRatio - truthGain) <= 0.05;

        // And the idle gate: a held target is not a measurement.
        var held = new LagMeter();
        uint h0 = HubClient.ClientNowUs();
        for (int ms = 0; ms <= 6000; ms += 10)
        {
            held.NoteIntent(unchecked(h0 + (uint)(ms * 1000)), 0.5);
            held.NoteRendered(unchecked(h0 + (uint)(ms * 1000)), 0.5);
        }
        held.Update(unchecked(h0 + 6_000_000));
        bool okIdle = held.Idle;

        Console.WriteLine($"  [{(okLag ? "PASS" : "FAIL")}] recovered shift within one step");
        Console.WriteLine($"  [{(okGain ? "PASS" : "FAIL")}] recovered gain within 0.05");
        Console.WriteLine($"  [{(okIdle ? "PASS" : "FAIL")}] a held target reads idle, not a number");
        return okLag && okGain && okIdle ? 0 : 1;
    }

    // =========================================================================
    // --lag : live check of the plugin's LagMeter against a known reference.
    //
    // Streams the SAME shape the plugin's Segments mode emits (100 ms timed
    // segments on 0x2101 scheduled SegLookaheadMs ahead) and feeds the plugin's
    // OWN LagMeter from both ends, so what prints here is the number the
    // plugin's status row will show. The reference it is checked against is
    // Nucleus's tools/lag_probe.py --segments over the same window; run them
    // back to back and compare.
    //
    // THIS ONE MOVES THE MACHINE, deliberately and with the operator's ruling:
    // it force-homes (home op 2 with a stroke, the RFC-025 bench op) and
    // config-sets a 0..50 mm window first, exactly as lag_probe.py does, since
    // a machine parked at the HOMED gate renders nothing to correlate against.
    // The home channel and op are the one hub-specific number in this file and
    // they are lag_probe.py's, not a guess; everything else is role-resolved.
    // =========================================================================
    private const ushort LagHomeChannel = 0x3101;   // tools/lag_probe.py:118 (Nucleus bench)
    private const int LagHomeOpStroke = 2;          // home op 2 = home to a declared stroke
    private const double LagStrokeMm = 50.0;
    private const double LagFreqHz = 0.8;
    private const double LagAmp = 0.35;
    private const double LagCenter = 0.5;
    private const int LagSegMs = 100;
    private const double LagLookaheadMs = 120.0;    // ValenceConnect.cs SegLookaheadMs
    private const double LagSeconds = 14.0;

    private static async Task<int> LagModeAsync(string ip, int port)
    {
        Console.WriteLine("=============================================================");
        Console.WriteLine($" Valence Connect LagMeter live check -- target {ip}:{port}");
        Console.WriteLine($" THIS MOVES THE MACHINE: force-home stroke {LagStrokeMm:F0} mm, window 0..{LagStrokeMm:F0} mm,");
        Console.WriteLine($" then {LagSeconds:F0}s of {LagFreqHz:F1} Hz sine as {LagSegMs} ms segments on 0x2101.");
        Console.WriteLine("=============================================================");

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        byte[] token16 = await MintUiTokenAsync(http, $"http://{ip}");
        if (token16 == null)
        {
            Console.WriteLine("ABORT: no /uitoken -- a watch-tier session cannot publish a stream.");
            return 3;
        }

        var instanceId = new byte[ValenceWire.InstanceIdBytes];
        RandomNumberGenerator.Fill(instanceId);
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        var token = cts.Token;

        using var ws = new ClientWebSocket();
        ws.Options.AddSubProtocol(ValenceWire.WsSubprotocol);
        ws.Options.KeepAliveInterval = TimeSpan.Zero;
        await ws.ConnectAsync(new Uri($"ws://{ip}:{port}/"), token);
        var client = new HubClient(ws, instanceId, Log);

        // The plugin's own Segments HELLO: both wishes, RFC-013 burst, RFC-030
        // family, and the safety subscription. The motion STATE subscription is
        // role-resolved below rather than wished here, because this hub's
        // motion channel is not the number ChMotion holds.
        var welcome = await client.HelloAsync("mfp", "MultiFunPlayer Valence Connect",
            new (ushort ch, double rate, double burst, byte curveFamily)[]
            {
                (ValenceWire.ChMotionInput, 50.0, 0.0, ValenceWire.CurveUnspecified),
                // The HONEST wish for what THIS harness sends: a constant
                // 1000/LagSegMs per second, not the plugin's 2-4/s script mean.
                // Wishing the plugin's 5 Hz here just buys a NACK storm.
                (ValenceWire.ChMotionSegment, 1000.0 / LagSegMs, 25.0, ValenceWire.CurveC1Cubic),
            },
            token16, token,
            new (ushort, double, byte)[] { (ValenceWire.ChSafety, 0.0, ValenceWire.PriorityCritical) });
        double segGranted = welcome.GrantedPublishRate(ValenceWire.ChMotionSegment);
        Console.WriteLine($"[welcome] session={welcome.SessionId} granted motion-segment={segGranted:F1} Hz");
        if (double.IsNaN(segGranted))
        {
            Console.WriteLine("ABORT: no motion-segment (0x2101) publish grant.");
            return 1;
        }

        var catalogBytes = await client.FetchCatalogAsync(token);
        if (catalogBytes == null) { Console.WriteLine("ABORT: catalog transfer produced nothing."); return 1; }
        var catalog = ValenceCatalog.Decode(catalogBytes);
        await client.SendCatalogReadyAsync(ValenceCatalog.Etag(catalogBytes), token);
        Console.WriteLine($"[ready] catalog {catalogBytes.Length} B, {catalog.Entries.Count} channels / {catalog.RoleCount} roles");

        var rPos = catalog.LocateRole(ValenceWire.RoleTelemetryPosition);
        var rMin = catalog.LocateRole(ValenceWire.RoleWindowMin);
        var rMax = catalog.LocateRole(ValenceWire.RoleWindowMax);
        if (rPos == null || rMin == null || rMax == null || !rMin.Writable || !rMax.Writable)
        {
            Console.WriteLine("ABORT: this hub does not advertise telemetry.position plus a writable window.min/max.");
            return 1;
        }
        Console.WriteLine($"[roles] telemetry.position -> 0x{rPos.ChannelId:X4} '{rPos.Field.Name}', "
            + $"window -> 0x{rMin.SettingChannel:X4} keys {rMin.SettingKey}/{rMax.SettingKey}");

        // The meter and the readback both run off the receive loop.
        var meter = new LagMeter();
        double winMin = double.NaN, winMax = double.NaN;
        long stateCount = 0, nackCount = 0;

        void OnNack(HubClient.NackInfo n)
        {
            nackCount++;
            Console.WriteLine($"    [recv] NACK {n.Name} channel=0x{n.Channel:X4} intent_seq={n.IntentSeq?.ToString() ?? "-"}");
        }

        void OnState(ushort channel, byte[] payload)
        {
            stateCount++;
            if (rMin.ChannelId == channel) { double v = ValenceCatalog.ReadField(payload, rMin.Field); if (!double.IsNaN(v)) winMin = v; }
            if (rMax.ChannelId == channel) { double v = ValenceCatalog.ReadField(payload, rMax.Field); if (!double.IsNaN(v)) winMax = v; }
            if (rPos.ChannelId != channel) return;
            double p = ValenceCatalog.ReadField(payload, rPos.Field);
            // Same mapping ValenceConnect.cs's AdoptRoleReadback feeds the meter.
            if (!double.IsNaN(p) && !double.IsNaN(winMin) && !double.IsNaN(winMax) && winMax - winMin > 1e-6)
                meter.NoteRendered(client.HubNowUs(), (p - winMin) / (winMax - winMin));
        }

        var recvTask = client.ReceiveLoopAsync(OnNack, OnState, token);

        Console.WriteLine($"[home] INTENT 0x{LagHomeChannel:X4} op {LagHomeOpStroke} stroke {LagStrokeMm:F0} mm (intent_id=1)");
        await client.SendIntentAsync(LagHomeChannel, 1, new (int, byte[])[]
        {
            (1, ValenceWire.CborUInt(LagHomeOpStroke)),
            (2, ValenceWire.CborF32(LagStrokeMm)),
        }, token);

        Console.WriteLine($"[window] INTENT 0x{rMin.SettingChannel:X4} 0..{LagStrokeMm:F0} mm (intent_id=2, role-resolved)");
        await client.SendIntentAsync(rMin.SettingChannel.Value, 2, new (int, byte[])[]
        {
            (rMin.SettingKey.Value, ValenceWire.CborF32(0.0)),
            (rMax.SettingKey.Value, ValenceWire.CborF32(LagStrokeMm)),
        }, token);

        // Position at a rate; the window on-change. Both are needed: without
        // the window this harness cannot map mm onto the normalized target the
        // intended series is expressed in, and the meter stays idle forever.
        var subs = new List<(ushort, double, byte)> { (rPos.ChannelId, 60.0, ValenceWire.PriorityElevated) };
        foreach (var ch in new[] { rMin.ChannelId, rMax.ChannelId })
            if (ch != rPos.ChannelId && !subs.Exists(e => e.Item1 == ch))
                subs.Add((ch, 0.0, ValenceWire.PriorityNormal));
        await client.SubscribeAsync(subs, token);
        Console.WriteLine($"[subscribe] {string.Join(", ", subs.ConvertAll(e => $"0x{e.Item1:X4}@{e.Item2:F0}Hz"))}");

        // Let the echoes and the config push land before anything is measured.
        await Task.Delay(1000, token);

        long bestRtt = long.MaxValue, bestOffset = 0;
        for (int i = 0; i < 5; i++)
        {
            var r = await client.ClockExchangeAsync(token);
            if (r == null) continue;
            if (r.Value.rtt < bestRtt) { bestRtt = r.Value.rtt; bestOffset = r.Value.offset; }
        }
        if (bestRtt == long.MaxValue) { Console.WriteLine("ABORT: no CLOCK exchange completed."); return 1; }
        client.SetClockOffset(bestOffset);
        Console.WriteLine($"[clock] offset={bestOffset} us rtt={bestRtt} us");
        Console.WriteLine();

        // ---- the stream, shaped exactly like SendSegmentAsync ----------------
        var sw = Stopwatch.StartNew();
        double nextMs = 0, lastPrintMs = 0;
        long sends = 0;
        var readings = new List<double>();
        double lead = (LagLookaheadMs + LagSegMs) / 1000.0;
        while (sw.Elapsed.TotalSeconds < LagSeconds && !token.IsCancellationRequested)
        {
            double nowMs = sw.Elapsed.TotalMilliseconds;
            if (nowMs < nextMs) { await Task.Delay((int)Math.Max(1, Math.Min(nextMs - nowMs, 5)), token); continue; }
            nextMs += LagSegMs;
            if (nextMs < nowMs) nextMs = nowMs + LagSegMs;

            // The target is the sine at the segment's END, so the intended
            // series carries the time this client MEANT each target for.
            double target = LagCenter + LagAmp * Math.Sin(2.0 * Math.PI * LagFreqHz * (sw.Elapsed.TotalSeconds + lead));
            uint dueClientUs = unchecked(HubClient.ClientNowUs() + (uint)(LagLookaheadMs * 1000.0));
            // Mirror of ValenceConnect.cs SendSegmentAsync: the meter is told
            // the segment's END, the wire is told its START.
            meter.NoteIntent(client.HubUsFromClientUs(unchecked(dueClientUs + (uint)(LagSegMs * 1000))), target);
            await client.SendSegmentSampleAsync(client.HubUsFromClientUs(dueClientUs),
                                                new SegmentSample(target, LagSegMs, 0.0, true), token);
            sends++;

            if (meter.Update(client.HubNowUs()) && sw.Elapsed.TotalMilliseconds - lastPrintMs >= 900)
            {
                lastPrintMs = sw.Elapsed.TotalMilliseconds;
                Console.WriteLine($"    t={sw.Elapsed.TotalSeconds,5:F1}s  meter: {meter.Summary}");
                // The first two seconds are the cold-start positioning move to
                // the stream's opening position, not content: same one-second
                // cut lag_probe.py takes before it fits.
                if (sw.Elapsed.TotalSeconds >= 4.0 && !meter.Idle) readings.Add(meter.LagMs);
            }
        }

        try { await client.GoodbyeAsync(ValenceWire.GoodbyeNormalClosure, CancellationToken.None); } catch { }
        await Task.Delay(300, CancellationToken.None);
        cts.Cancel();
        try { await recvTask; } catch (OperationCanceledException) { }
        try { if (ws.State == WebSocketState.Open) await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "lag done", CancellationToken.None); } catch { }

        Console.WriteLine();
        Console.WriteLine($"[result] segments sent={sends}  STATE frames={stateCount}  NACKs={nackCount}");
        Console.WriteLine($"[result] window read back {winMin:F1}..{winMax:F1} mm");
        if (readings.Count == 0)
        {
            Console.WriteLine("[result] meter never left idle -- nothing rendered to correlate against.");
            return 1;
        }
        readings.Sort();
        double median = readings[readings.Count / 2];
        Console.WriteLine($"[result] lag readings (settled): n={readings.Count} min={readings[0]:+0.0;-0.0} "
            + $"median={median:+0.0;-0.0} max={readings[readings.Count - 1]:+0.0;-0.0} ms");
        Console.WriteLine($"[result] final: {meter.Summary}");
        Console.WriteLine();
        Console.WriteLine("Compare against: python tools/lag_probe.py --ip " + ip
            + " --segments --seconds 14 --force-home 50 --window 0 50   (Nucleus repo)");
        return nackCount == 0 ? 0 : 1;
    }

    // Minimal mirror of ValenceConnect.cs's AcquireTokenAsync, mint-only rung (this
    // harness has no PIN box to try first). GET /uitoken has no CORS headers by
    // design (RFC-029 §4) — that property only matters to a browser, so a
    // console client just reads the body directly. Rate-limited server-side to
    // one mint per 250 ms device-wide; a couple of retries covers a stray 429.
    private static async Task<byte[]> MintUiTokenAsync(HttpClient http, string baseUrl)
    {
        for (int attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                using var res = await http.GetAsync($"{baseUrl}/uitoken");
                if (res.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    await Task.Delay(350);
                    continue;
                }
                if (!res.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[auth] /uitoken refused ({(int)res.StatusCode} {res.StatusCode})");
                    return null;
                }
                var j = JObject.Parse(await res.Content.ReadAsStringAsync());
                var tok = j.Value<string>("token");
                if (j.Value<bool?>("ok") == true && tok != null && tok.Length == ValenceWire.TokenBytes * 2)
                    return Convert.FromHexString(tok);
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[auth] /uitoken attempt {attempt} failed: {ex.Message}");
                await Task.Delay(200);
            }
        }
        return null;
    }

    private static async Task<(long bundles, long samples, long enqueued, long dropped)> ReadSyncCounters(HttpClient http, string baseUrl)
    {
        var body = await http.GetStringAsync($"{baseUrl}/api/kinetic");
        var obj = JObject.Parse(body);
        var sync = obj["sync"];
        long bundles = sync?.Value<long?>("bundles") ?? 0;
        long samples = sync?.Value<long?>("samples") ?? 0;
        long enqueued = sync?.Value<long?>("enqueued") ?? 0;
        long dropped = sync?.Value<long?>("dropped") ?? 0;
        return (bundles, samples, enqueued, dropped);
    }
}
