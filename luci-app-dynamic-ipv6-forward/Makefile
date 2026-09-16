include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dynamic-ipv6-forward
PKG_VERSION:=0.1.0
PKG_RELEASE:=6
PKG_MAINTAINER:=Alan Wanco
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE

include $(INCLUDE_DIR)/package.mk

# The SDK action builds packages whose default is a module. This does not
# include the package in firmware images unless the user selects it.
define Package/luci-app-dynamic-ipv6-forward
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Dynamic IPv6 Port Forwarding
  DEPENDS:=+luci-base +firewall4 +ip-full
  PKGARCH:=all
  DEFAULT:=m
endef

define Package/luci-app-dynamic-ipv6-forward/description
A LuCI application for maintaining dynamic IPv6 firewall redirects to LAN devices.
endef

define Package/luci-app-dynamic-ipv6-forward/conffiles
/etc/config/dynipv6forward
endef

define Package/luci-app-dynamic-ipv6-forward/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/dynipv6forward $(1)/etc/config/dynipv6forward
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/dynipv6forward $(1)/etc/init.d/dynipv6forward
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./root/usr/libexec/dynipv6forward $(1)/usr/libexec/dynipv6forward
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-dynipv6forward.json $(1)/usr/share/luci/menu.d/luci-app-dynipv6forward.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-dynipv6forward.json $(1)/usr/share/rpcd/acl.d/luci-app-dynipv6forward.json
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/dynipv6forward
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/dynipv6forward/overview.js $(1)/www/luci-static/resources/view/dynipv6forward/overview.js
endef

define Build/Configure
endef

define Build/Compile
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

$(eval $(call BuildPackage,luci-app-dynamic-ipv6-forward))
