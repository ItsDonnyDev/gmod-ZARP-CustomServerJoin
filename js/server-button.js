(function () {
	'use strict';

	var css = `
		#server_popup {
			position: fixed;
			bottom: 60px;
			background: #fff;
			border: 3px solid #333;
			border-radius: 4px;
			padding: 8px 4px;
			box-shadow: 0 4px 8px rgba(0,0,0,0.3);
			box-sizing: border-box;
			margin: 0;
		}

		.server_item {
			padding: 6px 4px;
			margin: 5px 0;
			border-radius: 3px;
			background: #f5f5f5;
			cursor: pointer;
			border-left: 4px solid #4CAF50;
			position: relative;
		}

		.server_item::after {
			content: '';
			position: absolute;
			bottom: 0;
			left: 2px;
			right: 2px;
			height: 1px;
			background: #aaaaaa;
		}

		.server_item.offline {
			border-left-color: #f44336;
			background: #fafafa;
			color: #666;
		}

		.server_item:hover {
			background: #d4edda;
		}

		.server_alias {
			font-weight: bold;
			font-size: 13px;
			margin-bottom: 2px;
		}

		.server_map {
			font-size: 11px;
			color: #666;
			margin-bottom: 1px;
		}

		.server_players {
			font-size: 11px;
			color: #888;
		}
	`;

	var privateServer = { address: "192.168.0.2:27016", password: "REDACTED1" };
	var serverList = [
		{ alias: "SSRP", address: "198.244.254.83:27015", password: "" },
		{ alias: "PROPHUNT", address: "198.244.254.83:27040", password: "" },
		{ alias: "SURF", address: "198.244.254.83:27030", password: "" },
		{ alias: "BHOP", address: "198.244.254.83:27019", password: "" },
		{ alias: "TTT", address: "198.244.254.83:27017", password: "" },
		{ alias: "DEATHRUN", address: "198.244.254.83:27035", password: "" },
		{ alias: "SANDBOX", address: "198.244.254.83:27045", password: "" }
	];

	var serverData = {};
	var queryingServers = {};
	var originalUpdateServer = window.UpdateServer;
	var originalSetPlayerList = window.SetPlayerList;

	function connectToServer() {
		lua.Run("RunConsoleCommand('password', '" + privateServer.password + "')");
		lua.Run("JoinServer('" + privateServer.address + "')");
	}

	function queryServerData(server) {
		serverData[server.address] = {
			ping: 0,
			name: 'Loading...',
			map: 'Loading...',
			players: 0,
			maxplayers: 0,
			online: false
		};
		queryingServers[server.address] = true;
		lua.Run("PingServer('" + server.address + "')");
		lua.Run("GetPlayerList('" + server.address + "')");

		setTimeout(function () {
			if (queryingServers[server.address] && serverData[server.address].name === 'Loading...') {
				serverData[server.address] = {
					ping: 0,
					name: 'Offline',
					map: 'Offline',
					players: 0,
					maxplayers: 0,
					online: false
				};
				delete queryingServers[server.address];
				refreshServerPopup();
			}
		}, 5000);
	}

	function refreshServerPopup() {
		var popup = document.getElementById('server_popup');
		if (!popup || popup.style.display === 'none') return;

		var content = popup.querySelector('.server_list_content');
		content.innerHTML = '';

		serverList.forEach(function (server) {
			var data = serverData[server.address] || {};
			var item = document.createElement('div');
			item.className = 'server_item' + (data.online ? '' : ' offline');
			item.innerHTML =
				'<div class="server_alias">' + server.alias + '</div>' +
				'<div class="server_map">' + (data.map || 'Offline') + '</div>' +
				'<div class="server_players">' + (data.players || 0) + '/' + (data.maxplayers || 0) + '</div>';
			item.onclick = function () {
				if (server.password) {
					lua.Run("RunConsoleCommand('password', '" + server.password + "')");
				}
				lua.Run("JoinServer('" + server.address + "')");
				toggleServerPopup();
			};
			content.appendChild(item);
		});
	}

	function getButtons() {
		var rightGroup = document.querySelector('#NavBar .group.right');
		if (!rightGroup) return null;
		var serverBtn = rightGroup.querySelector('.button[onmousedown^="handleServerButton"]');
		var problemsBtn = rightGroup.querySelector('[ng-click="ToggleProblems()"]');
		if (!serverBtn || !problemsBtn) return null;
		return { serverBtn: serverBtn, problemsBtn: problemsBtn };
	}

	function alignPopup() {
		var popup = document.getElementById('server_popup');
		if (!popup || popup.style.display === 'none') return;
		var btns = getButtons();
		if (!btns) return;
		var srvRect = btns.serverBtn.getBoundingClientRect();
		var prbRect = btns.problemsBtn.getBoundingClientRect();
		var left = Math.round(srvRect.left);
		var right = Math.round(prbRect.right);
		var width = Math.max(120, right - left);
		popup.style.left = left + 'px';
		popup.style.width = width + 'px';
	}

	function toggleServerPopup() {
		var popup = document.getElementById('server_popup');
		if (popup.style.display === 'none' || !popup.style.display) {
			$('.popup').hide();
			serverList.forEach(queryServerData);
			popup.style.display = 'block';
			window.requestAnimationFrame(function () { alignPopup(); refreshServerPopup(); });
		} else {
			popup.style.display = 'none';
		}
	}

	function handleServerButton(event) {
		event.preventDefault();
		if (event.button === 2) {
			connectToServer();
		} else if (event.button === 0) {
			toggleServerPopup();
		}
	}

	function updateServerData(address, ping, name, map, players, maxplayers) {
		return {
			ping: parseInt(ping) || 0,
			name: name || 'Offline',
			map: map || 'Offline',
			players: parseInt(players) || 0,
			maxplayers: parseInt(maxplayers) || 0,
			online: parseInt(ping) > 0 && parseInt(ping) < 9999
		};
	}

	function setupCallbacks() {
		window.UpdateServer = function (address, ping, name, map, players, maxplayers, botplayers, pass, lastplayed, gamemode, workshopid, isAnon, version, isFav, loc, gmcat) {
			if (queryingServers[address]) {
				serverData[address] = updateServerData(address, ping, name, map, players, maxplayers);
				refreshServerPopup();
				return;
			}

			for (var trackedAddr in queryingServers) {
				if (address.indexOf(trackedAddr.split(':')[0]) !== -1 || trackedAddr.indexOf(address.split(':')[0]) !== -1) {
					serverData[trackedAddr] = updateServerData(address, ping, name, map, players, maxplayers);
					refreshServerPopup();
					return;
				}
			}

			if (originalUpdateServer) {
				try {
					originalUpdateServer.apply(this, arguments);
				} catch (e) { }
			}
		};

		window.SetPlayerList = function (serverip, players) {
			var count = 0;
			if (players && typeof players === 'object') {
				count = Object.keys(players).length;
			}

			if (queryingServers[serverip] && serverData[serverip]) {
				serverData[serverip].players = count;
				refreshServerPopup();
				return;
			}

			for (var trackedAddr in queryingServers) {
				if (serverip.indexOf(trackedAddr.split(':')[0]) !== -1 || trackedAddr.indexOf(serverip.split(':')[0]) !== -1) {
					if (serverData[trackedAddr]) {
						serverData[trackedAddr].players = count;
						refreshServerPopup();
					}
					return;
				}
			}

			if (originalSetPlayerList) {
				try {
					originalSetPlayerList.apply(this, arguments);
				} catch (e) { }
			}
		};
	}

	function init() {
		var style = document.createElement('style');
		style.textContent = css;
		document.head.appendChild(style);

		var popup = document.createElement('div');
		popup.id = 'server_popup';
		popup.className = 'popup';
		popup.style.display = 'none';
		popup.innerHTML = '<div class="server_list_content"></div>';
		document.body.appendChild(popup);

		setupCallbacks();
		window.handleServerButton = handleServerButton;
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();