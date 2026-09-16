# luci-app-dynamic-ipv6-forward

> 面向只有一个域名、没有公网 IPv4 但拥有公网 IPv6，并希望通过 OpenWrt/ImmortalWrt 的 LuCI 将家中多台设备的多个端口转发到公网的用户。

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

## IPv6 direct access: DNS and DDNS

The plugin manages the **LAN target address and IPv6 port forwarding**. It does
not replace DNS or DDNS. To access a service by a stable hostname such as
`home.example.com`, configure the following pieces separately.

### 1. Check the prerequisites

- The ISP must provide the router with a global IPv6 address and delegate a
  global IPv6 prefix to the LAN. `fe80::/10` link-local addresses and private
  ULA addresses such as `fd00::/8` are not public entry points.
- The client must also have IPv6 connectivity. IPv4-only clients cannot reach
  this direct IPv6 endpoint without a relay, VPN, or other proxy.
- Use a dedicated subdomain for the home connection, for example
  `home.example.com`.

### 2. Configure DNS at the domain/DNS provider

At the authoritative DNS provider, create an **AAAA** record:

```text
Name:  home
Type:  AAAA
Value: <current router WAN global IPv6>
TTL:   60-300 seconds while testing
```

If the IPv6 prefix is dynamic, do not treat the current value as permanent; the
router DDNS client must update this record. Do not point the AAAA record at a
LAN address, `fe80::`, a ULA, or a CGNAT IPv4 address. If the provider offers a
proxy/CDN toggle, use DNS-only mode for arbitrary TCP/UDP ports unless that
provider explicitly supports the required proxy service.

### 3. Configure router DDNS

Install and enable the OpenWrt DDNS components, then configure them in LuCI
(**Services -> Dynamic DNS**) or with the provider's supported UCI profile:

- record/hostname: `home.example.com`;
- address source: **interface**, using the actual WAN IPv6 interface (for
  example `pppoe-wan` or `wan6`, depending on the router);
- IPv6 mode: enabled;
- HTTPS updates: enabled when supported;
- provider API credentials: least-privilege credentials stored only on the
  router, never in this repository.

DDNS updates the router WAN AAAA record. It does not discover the LAN service
address; this plugin performs that second job through MAC/NDP matching and an
optional fallback IID.

### 4. Configure this plugin

In **Network -> Dynamic IPv6 Forward**:

1. Add the LAN device and its MAC address. Set a fallback IID only when the
   device has a stable interface identifier.
2. Add one rule per protocol and port. TCP and UDP require separate rules.
3. Use the public port as the external port and the port listened to by the
   device as the internal port.
4. Save and apply, then check the status table for the discovered IPv6 and an
   `已生效`/active rule state.

The plugin creates IPv6-only `DIPv6F-*` firewall redirects. It does not open
UPnP or modify unrelated firewall rules.

### 5. Avoid proxy/DNS interference

When OpenClash or another DNS proxy is used, configure the home hostname as
`DIRECT` and add it to that client's Fake-IP exclusion list. Clear the client's
Fake-IP cache after changing the rule. Otherwise the hostname may resolve to a
synthetic address instead of the real AAAA record.

### 6. Verify from a real external IPv6 client

Test from a mobile network or another IPv6 host, not only from inside the home
LAN (IPv6 hairpin behavior varies):

```sh
nslookup -type=AAAA home.example.com 2606:4700:4700::1111
curl -6 -v "http://home.example.com:<public-port>/"
```

The router WAN firewall should keep a default-deny policy and expose only the
required ports. Port obfuscation is not authentication; use source restrictions,
keys/tokens, TLS/WSS for browser-facing services, and rate limiting as needed.

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
