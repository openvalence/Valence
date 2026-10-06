---
title: For everyone
description: >-
  What Valence changes for a machine owner: apps show the values the machine applied, any device on the network can send a stop, and the machine needs no internet connection.
---

# For everyone

This page covers what Valence changes for a machine owner: apps that agree with
the machine, firmware updates, the stop control, pairing and privacy.

Valence is a protocol between a machine and the apps you use with it. The
machine sends a description of its settings and readings, and the app builds
its screens from that description.

## App and machine agreement

If your app shows a number, that is the number the machine is using.

A machine has limits. When a request exceeds a limit, the machine applies the
nearest allowed value and reports it, and every app shows the reported value.

## Firmware updates and existing apps

When your machine gets new firmware, it describes itself again. Your apps read
the new description and keep working without an app update.

Apps do not need an update before you install new firmware, and you do not
need to hold back firmware for an app that has not been updated.

## New settings without an app update

If a machine update adds a setting, that setting appears in the apps you
already have, with the name, units and safe range the machine declares.

The app builds its screen from what the machine says it has.

## Machines from different makers

An app written for Valence asks each machine what it can do and shows that,
whatever the brand.

The app shows only the readings a machine declares, and uses the travel length
the machine reports.

## The stop control

**Any device that can reach the machine can stop it.** That includes a device
that is not allowed to control anything else: a spare phone, a tablet showing
a status page, a small remote you never paired.

Stopping needs no permission; starting needs a paired device with control
permission.

The machine also confirms that it stopped. The device that pressed stop keeps
asking until it sees the machine agree, so a lost message does not cancel a
stop.

Every machine that has a physical emergency stop still relies on it first.
The network stop is an additional path alongside the physical switch.

## Loss of the controlling device

When an app is driving the machine directly and it goes quiet, for example the
phone dies, the app crashes or the WiFi drops, the machine does not keep
executing a stream whose sender is gone. It stops receiving new instructions,
so motion ends when the last command has been executed. Nothing on the machine
broadcasts an emergency stop on your behalf; the hardware and software stop
controls covered above are still there if you need them right now.

If you started a pattern that the *machine itself* is running, your screen
locking does not interrupt it.

## Pairing new devices

When a new device asks to control your machine, you approve it on hardware you
already hold: your phone, or a page on the machine itself.

You see what is asking before you say yes. Nothing is granted without that
approval, and you can take that permission away later from the same place.

A brand-new machine, out of the box, trusts the first device that asks.
Powering on a factory-fresh machine is the proof of possession, and the first
device to ask is paired.

## Local-only operation

Your machine talks to your apps over your own network. Valence uses no account and no online service, and no third party relays your
traffic.

The machine collects and uploads no usage data and works the same without an
internet connection. If your router goes down, your machine
and your phone still talk to each other.

It is designed for a home network and is not built to be reachable from the
internet.

## Machine restarts after an update

Your machine restarts, which takes a few seconds. Your apps reconnect on their
own and adopt the machine's current state.

Motion does not resume after a restart, even when an app reconnects; a person
has to start it again.

## Out of scope

- It does not decide how your machine moves. It does not plan motion; the machine's
  firmware does.
- It does not replace your existing app or interface.
- It is not a security product. It keeps a stranger's device from casually
  taking over on your network. It is not designed to stop an attacker on the same
  network who can capture and inject traffic.

## Related pages

- [How it works](how-it-works.md): the mental model, with diagrams.
- [Security model](security.md): what is protected and what is not.
