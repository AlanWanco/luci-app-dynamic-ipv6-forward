include $(TOPDIR)/rules.mk

LUCI_TITLE:=Dynamic IPv6 Port Forwarding
LUCI_DEPENDS:=+luci-base +firewall4 +ip-full
LUCI_PKGARCH:=all

PKG_MAINTAINER:=Alan Wanco
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

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

# luci.mk invokes BuildPackage for this LuCI application.
