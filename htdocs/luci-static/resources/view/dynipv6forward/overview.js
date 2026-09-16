'use strict';
'require view';
'require ui';
'require uci';
'require fs';
'require form';

function htmlEscape(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function statusOutput(result) {
	if (!result)
		return '';
	return result.stdout || result.stderr || '';
}

function parseKeyValues(fields) {
	var values = {};
	fields.forEach(function(field) {
		var separator = field.indexOf('=');
		if (separator > 0)
			values[field.slice(0, separator)] = field.slice(separator + 1);
	});
	return values;
}

function reasonText(reason) {
	var labels = {
		'NDP/MAC match': '已通过 MAC/NDP 匹配',
		'fallback IID': '使用备用 IID',
		'manual IPv6': '使用手动 IPv6',
		'disabled': '设备已禁用',
		'no LAN device': '未配置 LAN 接口',
		'no matching NDP address': '暂未发现匹配地址'
	};
	return labels[reason] || reason || '-';
}

function badge(text, color) {
	return '<span style="display:inline-block;padding:0.15em 0.55em;border-radius:0.35em;' +
		'background:' + color + ';color:#fff;font-size:0.9em;white-space:nowrap">' +
		htmlEscape(text) + '</span>';
}

function forwardState(value) {
	if (value === '1')
		return badge('已生效', '#198754');
	if (value === '0')
		return badge('已禁用', '#6c757d');
	return badge('规则不存在', '#dc3545');
}

function renderStatus(text) {
	var service = {};
	var lan = {};
	var targets = [];
	var forwards = [];
	var diagnostics = [];
	var lastTarget;

	String(text || '').split(/\r?\n/).forEach(function(line) {
		if (!line)
			return;

		var fields = line.split('\t');
		switch (fields[0]) {
		case 'SERVICE':
			service = parseKeyValues(fields.slice(1));
			break;
		case 'LAN':
			lan = parseKeyValues(fields.slice(1));
			break;
		case 'TARGET':
			lastTarget = {
				id: fields[1] || '-',
				name: fields[2] || fields[1] || '-',
				ip: fields[3] || '-',
				reason: fields[4] || '-'
			};
			targets.push(lastTarget);
			break;
		case 'FORWARD':
			forwards.push({
				id: fields[1] || '-',
				name: fields[2] || fields[1] || '-',
				target: fields[3] || '-',
				proto: (fields[4] || '-').toUpperCase(),
				external: fields[5] || '-',
				internal: fields[6] || '-',
				ip: fields[7] || '-',
				state: fields[8] || 'missing'
			});
			break;
		default:
			if (line.indexOf('  interface=') === 0 && lastTarget) {
				var details = parseKeyValues(line.trim().split(/\s+/));
				lastTarget.interface = details.interface || '-';
				lastTarget.mac = details.mac || '-';
			} else if (line.trim()) {
				diagnostics.push(line);
			}
		}
	});

	if (!service.enabled && !lan.interface && !targets.length && !forwards.length) {
		return '<div style="padding:0.75em;color:#666">' +
			(htmlEscape(diagnostics.join('\n')) || '暂无状态，请点击“立即同步”。') + '</div>';
	}

	var html = '<div style="width:100%;max-width:100%;overflow-x:auto;line-height:1.5">';
	html += '<div style="display:flex;flex-wrap:wrap;gap:0.6em;margin:0 0 1em">';
	html += '<div><strong>后台服务：</strong>' +
		(service.enabled === '1' ? badge('运行中', '#198754') : badge('已停用', '#6c757d')) + '</div>';
	html += '<div><strong>扫描间隔：</strong><code>' + htmlEscape(service.interval || '-') +
		'</code> 秒</div>';
	html += '<div><strong>默认 LAN 接口：</strong><code>' + htmlEscape(lan.interface || '-') + '</code></div>';
	html += '</div>';

	html += '<h4 style="margin:0.8em 0 0.4em">设备发现状态</h4>';
	if (targets.length) {
		html += '<table class="table" style="min-width:760px;margin:0;white-space:nowrap">';
		html += '<thead><tr><th>设备</th><th>当前 IPv6</th><th>发现方式</th><th>接口</th><th>MAC</th></tr></thead><tbody>';
		targets.forEach(function(target) {
			html += '<tr><td><strong>' + htmlEscape(target.name) + '</strong><br><small>' +
				htmlEscape(target.id) + '</small></td><td><code>' + htmlEscape(target.ip) +
				'</code></td><td>' + htmlEscape(reasonText(target.reason)) + '</td><td><code>' +
				htmlEscape(target.interface || '-') + '</code></td><td><code>' +
				htmlEscape(target.mac || '-') + '</code></td></tr>';
		});
		html += '</tbody></table>';
	} else {
		html += '<p style="color:#666">没有配置设备。</p>';
	}

	html += '<h4 style="margin:1.2em 0 0.4em">端口转发状态</h4>';
	if (forwards.length) {
		html += '<table class="table" style="min-width:980px;margin:0;white-space:nowrap">';
		html += '<thead><tr><th>规则</th><th>目标设备</th><th>协议</th><th>公网端口</th><th>内部端口</th><th>当前目标 IPv6</th><th>状态</th></tr></thead><tbody>';
		forwards.forEach(function(forward) {
			html += '<tr><td><strong>' + htmlEscape(forward.name) + '</strong><br><small>' +
				htmlEscape(forward.id) + '</small></td><td>' + htmlEscape(forward.target) +
				'</td><td>' + htmlEscape(forward.proto) + '</td><td><code>' +
				htmlEscape(forward.external) + '</code></td><td><code>' +
				htmlEscape(forward.internal) + '</code></td><td><code>' + htmlEscape(forward.ip) +
				'</code></td><td>' + forwardState(forward.state) + '</td></tr>';
		});
		html += '</tbody></table>';
	} else {
		html += '<p style="color:#666">没有配置端口转发规则。</p>';
	}

	if (diagnostics.length)
		html += '<details style="margin-top:1em"><summary>其他输出</summary><pre style="white-space:pre;overflow:auto">' +
			htmlEscape(diagnostics.join('\n')) + '</pre></details>';

	return html + '</div>';
}

function targetTitle(section_id) {
	return uci.get('dynipv6forward', section_id, 'name') || section_id;
}

function validateInterfaceName(section_id, value) {
	if (!value)
		return '请输入 LAN 接口名，例如 br-lan';
	return /^[A-Za-z0-9_.:-]{1,15}$/.test(value) ? true :
		'请输入有效 Linux 接口名，例如 br-lan 或 eth0.2';
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('dynipv6forward'),
			L.resolveDefault(fs.exec('/usr/libexec/dynipv6forward', [ 'status' ]), { stdout: '', stderr: '' })
		]);
	},

	render: function(data) {
		var initialStatus = statusOutput(data[1]);
		var m = new form.Map('dynipv6forward', '动态 IPv6 转发',
			'先配置“设备”，再配置“端口转发规则”。插件会按 MAC/NDP 自动找到设备当前全局 IPv6，随后更新 IPv6 DNAT。\n' +
			'公网 DDNS 记录仍应指向路由器 WAN IPv6；本页面不会修改 OpenClash 或 DDNS。');
		var statusId = 'dynipv6forward-status';
		var statusOption;

		var global = m.section(form.NamedSection, 'global', 'dynipv6forward', '全局设置');
		var o = global.option(form.Flag, 'enabled', '启用后台服务',
			'关闭后，插件管理的转发规则会被禁用，但不会删除。');
		o.default = '1';
		o.rmempty = false;

		o = global.option(form.Value, 'interval', '扫描间隔（秒）',
			'建议 30 秒。数值过小会增加路由器负载。');
		o.datatype = 'range(10,3600)';
		o.default = '30';
		o.rmempty = false;

		o = global.option(form.Value, 'interface', '默认 LAN 接口',
			'填写 Linux 接口名，例如 br-lan、eth0.2。br-lan 是合法接口名，不是 UCI 配置段名称。');
		o.default = 'br-lan';
		o.rmempty = false;
		o.validate = validateInterfaceName;

	statusOption = global.option(form.DummyValue, '_status', '运行状态');
	statusOption.rawhtml = true;
	statusOption.cfgvalue = function() {
		return '<div id="' + statusId + '" style="width:100%;max-width:100%;overflow-x:auto">' +
			renderStatus(initialStatus) + '</div>';
	};

	o = global.option(form.Button, '_sync', '手动操作');
	o.inputtitle = '立即同步';
	o.inputstyle = 'apply';
	o.onclick = function(ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		return fs.exec('/usr/libexec/dynipv6forward', [ 'sync' ])
			.then(function(result) {
				return fs.exec('/usr/libexec/dynipv6forward', [ 'status' ]).then(function(status) {
					var box = document.getElementById(statusId);
					if (box)
						box.innerHTML = renderStatus(statusOutput(status));
					if (result && result.stderr)
						ui.addNotification(null, E('p', result.stderr));
				});
			})
			.catch(function(error) {
				ui.addNotification(null, E('p', error.message || String(error)));
			})
			.finally(function() {
				ev.currentTarget.classList.remove('spinning');
				ev.currentTarget.disabled = false;
			});
	};

	var targets = m.section(form.GridSection, 'target', '设备');
	targets.description = '这里填写内网设备。优先使用 MAC 从 IPv6 邻居表发现地址；设备暂时离线或邻居记录尚未出现时，才使用备用 IID。';
	targets.addremove = true;
	targets.anonymous = true;
	targets.sortable = true;
	targets.modaltitle = '设备';
	targets.sectiontitle = function(section_id) {
		return targetTitle(section_id);
	};

	o = targets.option(form.Value, 'name', '名称');
	o.modalonly = true;
	o.rmempty = false;
	o.datatype = 'maxlength(64)';
	o.placeholder = '例如 Mac / Bot / Windows';

	o = targets.option(form.Flag, 'enabled', '启用');
	o.default = '1';
	o.editable = true;
	o.rmempty = false;

	o = targets.option(form.Value, 'interface', '设备所在 LAN 接口',
		'例如 br-lan 或 eth0.2。这里是 Linux 接口名，不要求符合 UCI 配置段命名规则。');
	o.modalonly = true;
	o.default = uci.get('dynipv6forward', 'global', 'interface') || 'br-lan';
	o.rmempty = false;
	o.validate = validateInterfaceName;

	o = targets.option(form.DynamicList, 'mac', 'MAC 地址',
		'从 IPv6 邻居表匹配。可添加多个 MAC，例如设备同时使用有线和无线网络。');
	o.modalonly = true;
	o.datatype = 'list(macaddr)';
	o.rmempty = true;
	o.placeholder = 'aa:bb:cc:dd:ee:ff';

	o = targets.option(form.Value, 'fallback_iid', '备用 IID',
		'可选的 IPv6 接口标识末段，例如 abcd:1234:5678:9abc。仅在 MAC 邻居暂时不可见时使用。');
	o.modalonly = true;
	o.rmempty = true;
	o.validate = function(section_id, value) {
		if (!value)
			return true;
		return /^[0-9A-Fa-f]{1,4}(:[0-9A-Fa-f]{1,4}){3}$/.test(value) ? true :
			'请输入 4 段十六进制 IID，例如 abcd:1234:5678:9abc';
	};

	o = targets.option(form.Value, 'manual_ip', '手动 IPv6（可选）',
		'适用于地址固定的设备；填写后优先于 MAC/NDP 发现。');
	o.modalonly = true;
	o.rmempty = true;
	o.datatype = 'ip6addr';

	var forwards = m.section(form.GridSection, 'forward', '端口转发规则');
	forwards.description = '每条规则对应一个 TCP 或 UDP 端口。TCP 和 UDP 必须分别建立规则；公网端口可以和设备实际监听的内部端口不同。';
	forwards.addremove = true;
	forwards.anonymous = true;
	forwards.sortable = true;
	forwards.modaltitle = '端口转发规则';
	forwards.sectiontitle = function(section_id) {
		return uci.get('dynipv6forward', section_id, 'name') || section_id;
	};

	o = forwards.option(form.Value, 'name', '名称');
	o.modalonly = true;
	o.rmempty = false;
	o.datatype = 'maxlength(64)';
	o.placeholder = '例如 Mac Sunshine TCP 48984';

	o = forwards.option(form.Flag, 'enabled', '启用');
	o.default = '1';
	o.editable = true;
	o.rmempty = false;

	var targetOpt = forwards.option(form.ListValue, 'target', '目标设备');
	uci.sections('dynipv6forward', 'target', function(section) {
		targetOpt.value(section['.name'], section.name || section['.name']);
	});
	targetOpt.modalonly = true;
	targetOpt.rmempty = false;

	o = forwards.option(form.ListValue, 'proto', '协议');
	o.value('tcp', 'TCP');
	o.value('udp', 'UDP');
	o.default = 'tcp';
	o.rmempty = false;

	o = forwards.option(form.Value, 'external_port', '公网端口（IPv6 入站）',
		'外部客户端访问的端口，可填写单个端口或范围，例如 48984 或 50000-50010；范围必须在 1-65535。');
	o.modalonly = true;
	o.rmempty = false;
	o.datatype = 'portrange';

	o = forwards.option(form.Value, '内部端口（设备监听）',
		'目标设备实际监听的端口；留空时使用与公网端口相同的端口。');
	o.modalonly = true;
	o.rmempty = true;
	o.datatype = 'portrange';

	o = forwards.option(form.Value, 'source_ip', '来源 IPv6 限制（可选）',
		'填写 IPv6 地址或 CIDR 后，仅允许该来源访问；留空表示不限制来源。');
	o.modalonly = true;
	o.rmempty = true;
	o.validate = function(section_id, value) {
		if (!value)
			return true;
		return /^[0-9A-Fa-f:]+(?:\/[0-9]{1,3})?$/.test(value) ? true : '请输入 IPv6 地址或 CIDR';
	};

	return m.render();
}
});
