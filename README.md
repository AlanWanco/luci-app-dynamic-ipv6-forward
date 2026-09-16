# luci-app-dynamic-ipv6-forward

> 面向只有一个域名、没有公网 IPv4 但拥有公网 IPv6，并希望通过 OpenWrt/ImmortalWrt 的 LuCI 将家中多台设备的多个端口转发到公网的用户。

这是一个适用于 OpenWrt/ImmortalWrt firewall4（fw4/nftables）的 LuCI 插件。它
会按设备 MAC 地址从 IPv6 邻居表发现当前全局 IPv6，在运营商更换 IPv6 前缀后
自动更新 IPv6 端口转发规则。

## 功能

- 在 LuCI 中管理内网设备和端口转发；
- 按 MAC/NDP 自动发现设备当前全局 IPv6；
- 支持备用 64 位 IID 和手动 IPv6 地址；
- 支持 TCP、UDP、单端口和端口范围；
- 支持公网端口与内部监听端口分离；
- 支持按来源 IPv6/CIDR 限制访问；
- 状态页面显示设备发现结果和实际防火墙规则；
- 不启用 UPnP，只管理名称以 `DIPv6F-` 开头的规则，不修改其他防火墙规则。

## 工作原理

```text
客户端 IPv6
    │
    ▼
路由器 WAN IPv6 + DDNS AAAA
    │  IPv6 DNAT（fw4/nftables）
    ▼
内网设备当前全局 IPv6
```

DDNS 负责更新路由器 WAN IPv6 对应的 AAAA 记录；本插件负责发现 LAN 设备的
IPv6 并维护端口转发。这两个功能相互独立。

## 安装

### 使用 Release 中的 IPK

从 GitHub **Releases** 下载对应版本，然后在路由器上执行：

```sh
opkg update
opkg install /tmp/luci-app-dynamic-ipv6-forward_*.ipk
```

本插件是架构无关的 LuCI/脚本包，安装时会由 `opkg` 解析并安装运行依赖。安装
脚本会启用并启动 `dynipv6forward` 服务。

安装后打开：

```text
LuCI → 网络 → 动态 IPv6 转发
```

### 从源码构建

使用与目标路由器版本匹配的 OpenWrt/ImmortalWrt SDK 或完整源码树。最简单的
方式是把包目录复制到 SDK 的 `package/` 目录：

```sh
git clone https://github.com/AlanWanco/luci-app-dynamic-ipv6-forward.git
cp -a luci-app-dynamic-ipv6-forward/luci-app-dynamic-ipv6-forward /path/to/openwrt/package/
cd /path/to/openwrt
make defconfig
make package/luci-app-dynamic-ipv6-forward/compile V=s
```

也可以使用本地 feed：

```sh
echo "src-link action /path/to/luci-app-dynamic-ipv6-forward" >> feeds.conf
./scripts/feeds update action
./scripts/feeds install -p action -f luci-app-dynamic-ipv6-forward
make package/luci-app-dynamic-ipv6-forward/compile V=s
```

仓库自带 GitHub Actions，会使用 OpenWrt 24.10.2 SDK 构建 `x86_64` 和
`aarch64_cortex-a53` IPK。

## 域名解析、DDNS 与 IPv6 直连

要通过一个稳定域名访问家中服务，需要在域名服务商和路由器上分别配置。
下面使用 `home.example.com` 作为示例，请替换成自己的域名。

### 1. 网络前提

- 运营商必须给路由器提供全局 IPv6，并向 LAN 下发全局 IPv6 前缀；
- `fe80::/10` 链路本地地址和 `fd00::/8` ULA 不是公网入口；
- 外部客户端也必须具备 IPv6。纯 IPv4 客户端需要 VPS、VPN 或其他中转；
- IPv6 前缀可能动态变化，不能把当前 IPv6 永久写死。

### 2. 在域名服务商配置 AAAA

在权威 DNS 服务商处创建 AAAA 记录：

```text
主机记录：home
记录类型：AAAA
记录值：  <路由器当前 WAN 全局 IPv6>
TTL：     测试时可设置为 60-300 秒
```

注意事项：

- 不要把 AAAA 指向 LAN 设备地址、`fe80::`、ULA 或 CGNAT IPv4；
- 如果 DNS 服务商有 CDN/代理开关，任意 TCP/UDP 端口通常应使用“仅 DNS”模式；
- 如果该子域名存在错误的 A 记录，IPv4-only 客户端可能会优先尝试 IPv4；
- DNS 服务商的 API 密钥应使用最小权限，并且只保存在路由器上。

### 3. 在路由器配置 DDNS

安装并启用 OpenWrt 的 DDNS 组件，在 LuCI 的“服务 → 动态 DNS”中创建服务：

- 域名/查询主机：`home.example.com`；
- IP 来源：**接口**；
- WAN IPv6 接口：选择实际接口，例如 `pppoe-wan` 或 `wan6`；
- 启用 IPv6 更新；
- 服务商支持时启用 HTTPS；
- 填写服务商 API 凭据，但不要把凭据提交到 GitHub。

不同服务商的 `service_name`、认证字段和 API 配置不同，应以对应的
`ddns-scripts` 模板为准。DDNS 只更新路由器 WAN AAAA，不负责发现 LAN 设备。

### 4. 在本插件中配置端口转发

在“网络 → 动态 IPv6 转发”中：

1. 在“设备”中添加内网设备和 MAC 地址；
2. 设备所在接口填写 Linux 接口名，例如 `br-lan` 或 `eth0.2`；
3. 设备地址暂时无法从 NDP 发现时，再配置备用 IID；
4. 每个 TCP/UDP 端口分别建立规则；
5. 公网端口填写外部访问端口，内部端口填写设备实际监听端口；
6. 保存应用后，在状态表中确认设备 IPv6 和规则状态为“已生效”。

### 5. OpenClash 和 Fake-IP

如果客户端或路由器使用 OpenClash 等 DNS 代理，需要将家庭域名设置为
`DIRECT`，并加入 Fake-IP 排除列表。修改后清理客户端 Fake-IP 缓存，否则域名
可能解析到合成地址，而不是实际 AAAA 记录。

### 6. 从真正外部 IPv6 客户端测试

不要只在家中 LAN 内测试，IPv6 hairpin 行为可能不同。可以使用移动网络或其他
IPv6 主机：

```sh
nslookup -type=AAAA home.example.com 2606:4700:4700::1111
curl -6 -v "http://home.example.com:<公网端口>/"
```

## LuCI 配置说明

### 设备

- **名称**：仅用于显示；
- **设备所在 LAN 接口**：Linux 接口名，例如 `br-lan`；
- **MAC 地址**：从 IPv6 邻居表匹配，可填写多个；
- **备用 IID**：四段十六进制接口标识，例如 `abcd:1234:5678:9abc`；
- **手动 IPv6**：固定地址设备可以填写，优先级高于 MAC/NDP。

### 端口转发规则

- TCP 和 UDP 必须分别配置；
- 公网端口和内部端口可以不同；
- 端口范围格式为 `起始端口-结束端口`；
- 端口范围必须在 `1-65535` 内；
- 可选的来源 IPv6/CIDR 限制可以减少公网暴露面。

插件只维护 `DIPv6F-*` 防火墙 redirect。禁用插件或设备时，规则会被禁用而
不会删除；删除规则或卸载插件时，插件管理的规则会被清理。

## 安全提示

- WAN 防火墙建议保持默认拒绝，只开放明确需要的端口；
- 端口改名或改成非常用端口不能替代认证、TLS、限流和来源限制；
- WebSocket 使用 TCP，不需要额外的 UDP 转发；
- 浏览器从 HTTPS 页面访问服务时，应使用 HTTPS/WSS 反向代理，避免 Mixed Content；
- 不要把 DDNS API 密钥、Token、私钥或个人网络配置提交到仓库。

## 卸载

```sh
opkg remove luci-app-dynamic-ipv6-forward
```

卸载脚本会停止服务并清理本插件管理的 `DIPv6F-*` 防火墙规则，不会删除其他
插件或无关防火墙配置。

## 兼容性

- OpenWrt/ImmortalWrt 23.05 及更新版本；
- firewall4/fw4 和 nftables；
- LAN 必须有可路由的全局 IPv6；
- 运行时需要 `ip-full`；
- 不依赖 OpenClash，也不会修改 OpenClash 或 DDNS 配置。

## 许可证

MIT License，见 [LICENSE](LICENSE)。
