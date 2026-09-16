include $(TOPDIR)/rules.mk

LUCI_TITLE:=Dynamic IPv6 Port Forwarding
LUCI_DEPENDS:=+luci-base +firewall4 +ip-full
LUCI_PKGARCH:=all
# Build the file-only package in SDK/feed CI's default all-package build.
# It remains a module and is not included in firmware images automatically.
LUCI_DEFAULT:=m

PKG_MAINTAINER:=Alan Wanco
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_VERSION:=0.1.0
PKG_RELEASE:=3

define Package/luci-app-dynamic-ipv6-forward/conffiles
/etc/config/dynipv6forward
endef

define Package/luci-app-dynamic-ipv6-forward/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null || true
	/etc/init.d/dynipv6forward enable
	/etc/init.d/dynipv6forward restart
fi
exit 0
endef

define Package/luci-app-dynamic-ipv6-forward/prerm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	/etc/init.d/dynipv6forward stop 2>/dev/null || true
	/etc/init.d/dynipv6forward disable 2>/dev/null || true
fi
exit 0
endef

define Package/luci-app-dynamic-ipv6-forward/postrm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	case "$${1:-remove}" in
	remove|purge)
		uci -q show firewall 2>/dev/null | \
			sed -n "s/^firewall\\.\\(@redirect\\[[0-9][0-9]*\\]\\)\\.name='DIPv6F-[^']*'$/\\1/p" | \
			while read -r section; do
				[ -n "$${section}" ] && uci -q delete "firewall.$${section}"
			done
		uci -q commit firewall
		fw4 reload 2>/dev/null || true
		;;
	esac
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null || true
fi
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# luci.mk invokes BuildPackage for this LuCI application.
