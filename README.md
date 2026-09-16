# luci-app-dynamic-ipv6-forward

A small, architecture-independent LuCI application for IPv6-only dynamic port forwarding on OpenWrt/fw4.

It stores device and forwarding definitions in `/etc/config/dynipv6forward`. A
procd service discovers a device's current global IPv6 address from the LAN IPv6
neighbor table (matched by MAC address), optionally falls back to a configured
stable IID, and maintains plugin-owned `firewall redirect` sections in fw4.

The application deliberately does not enable UPnP or alter a router's DDNS
configuration. In a single-domain setup, the DDNS AAAA record should point at
the router WAN IPv6 and the firewall redirects public ports to the discovered
LAN IPv6 address.

## LuCI usage

Open **Network -> Dynamic IPv6 Forward**. Configure a device first, then add
one forwarding rule for each protocol/port. The LAN interface is a Linux
interface name such as `br-lan` or `eth0.2`; it is not a UCI section name.
The status panel presents device discovery and firewall rules as separate
responsive tables. Long IPv6 addresses remain on one line and can be scrolled
horizontally on a narrow screen.

The service only owns firewall redirects whose names start with `DIPv6F-`.
Existing unrelated firewall rules are left untouched. A source IPv6/CIDR
restriction can be used to limit an exposed port to a known client.

## Install

Download the IPK matching the release from **Releases**, then install it on the
router. The package is architecture-independent; its runtime dependencies are
resolved by `opkg`:

```sh
opkg update
opkg install /tmp/luci-app-dynamic-ipv6-forward_*.ipk
```

The package enables and starts the `dynipv6forward` service after installation.
Open **Network -> Dynamic IPv6 Forward**, configure devices and forwarding rules,
and click **Save & Apply**. A package upgrade preserves `/etc/config/dynipv6forward`.

## Compatibility and security

The plugin requires `firewall4`/fw4, nftables, IPv6 connectivity on the LAN, and
`ip-full`. It is intended for OpenWrt/ImmortalWrt 23.05 or newer. It does not
enable UPnP, change DDNS, or depend on OpenClash. Only redirects whose names
start with `DIPv6F-` are managed; unrelated firewall rules are left untouched.
IPv6 port exposure should still use source restrictions, authentication, TLS,
and rate limiting where appropriate.

## Development

This is an OpenWrt package. Build it with the OpenWrt/ImmortalWrt SDK or buildroot
and install the resulting `luci-app-dynamic-ipv6-forward` IPK. The package is
architecture-independent, but the SDK must match the target OpenWrt release.
