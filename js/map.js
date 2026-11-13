const mapElement = document.querySelector("#map");
const map = L.map(mapElement, {
    scrollWheelZoom: true,
    zoomControl: false,
}).setView([39.98, -75.16], 11);
L.control.zoom({ position: "topright" }).addTo(map);

let resizeFrame;
window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false });
    });
});

const welcomeScreen = document.querySelector("#welcome-screen");
const enterMapButton = document.querySelector("#enter-map");
welcomeScreen.showModal();
enterMapButton.addEventListener("click", () => {
    welcomeScreen.close();
    map.invalidateSize();
    mapElement.focus({ preventScroll: true });
});

const birdIcon = L.icon({
    iconUrl: "images/bird.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: "bird-marker",
    alt: "Bird recording location",
});
const selectedBirdIcon = L.icon({
    iconUrl: "images/bird-selected.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: "bird-marker bird-marker-selected",
    alt: "Selected bird recording location",
});

const recordingPanel = document.createElement("aside");
recordingPanel.className = "recording-panel";
recordingPanel.setAttribute("aria-label", "Selected bird recording");
recordingPanel.setAttribute("aria-live", "polite");
L.DomEvent.disableClickPropagation(recordingPanel);
L.DomEvent.disableScrollPropagation(recordingPanel);

const closeRecordingButton = document.createElement("button");
closeRecordingButton.className = "close-recording";
closeRecordingButton.type = "button";
closeRecordingButton.setAttribute("aria-label", "Close recording panel");
closeRecordingButton.textContent = "×";
closeRecordingButton.addEventListener("click", () => {
    recordingPanel.hidden = true;
    selectedMarker?.setIcon(birdIcon);
    selectedMarker = undefined;
});
recordingPanel.append(closeRecordingButton);

const mapSidebar = document.createElement("div");
mapSidebar.className = "map-sidebar";

const mapIntro = document.createElement("section");
mapIntro.className = "map-title";

const titleRow = document.createElement("div");
titleRow.className = "map-title-row";
const titleBirdIcon = document.createElement("img");
titleBirdIcon.src = "images/bird.png";
titleBirdIcon.alt = "";
titleBirdIcon.setAttribute("aria-hidden", "true");
titleRow.append(titleBirdIcon);

const mapTitle = document.createElement("h1");
mapTitle.textContent = "Birds of Philly";
titleRow.append(mapTitle);
mapIntro.append(titleRow);

const mapDescription = document.createElement("p");
const mapDescription2 = document.createElement("p");
mapDescription.textContent = " Select a bird marker to listen.";
mapDescription2.textContent = "Try Guessing Mode to test your bird-call knowledge.";

mapIntro.append(mapDescription);
mapIntro.append(mapDescription2);
mapSidebar.append(mapIntro, recordingPanel);
mapElement.append(mapSidebar);

let guessingMode = false;
let selectedRecording;
let selectedMarker;
let recordingRevealed = false;

const guessingToggle = document.createElement("button");
guessingToggle.className = "guessing-toggle";
guessingToggle.type = "button";
guessingToggle.setAttribute("aria-pressed", "false");
guessingToggle.textContent = "Enter Guessing Mode";
guessingToggle.addEventListener("click", (event) => {
    L.DomEvent.stopPropagation(event);
    guessingMode = !guessingMode;
    recordingRevealed = false;
    guessingToggle.setAttribute("aria-pressed", String(guessingMode));
    guessingToggle.textContent = guessingMode ? "Exit Guessing Mode" : "Enter Guessing Mode";
    guessingToggle.classList.toggle("is-active", guessingMode);
    recordingPanel.classList.toggle("guessing-mode", guessingMode);
    if (selectedRecording) renderRecording();
});
mapElement.append(guessingToggle);

function showMapNotice(text) {
    let notice = mapElement.querySelector(".map-notice");
    if (!notice) {
        notice = document.createElement("p");
        notice.className = "map-notice";
        mapElement.append(notice);
    }
    notice.textContent = text;
}

const mapTilerApiKey = window.MAPTILER_API_KEY?.trim();
const tileLayer = mapTilerApiKey
    ? L.tileLayer(`https://api.maptiler.com/maps/bright-v2-pastel/{z}/{x}/{y}.png?key=${encodeURIComponent(mapTilerApiKey)}`, {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
    : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    });

tileLayer.on("tileerror", () => {
    if (mapTilerApiKey) {
        showMapNotice("MapTiler tiles failed to load. Check the API key in js/config.js and its allowed domains.");
    }
});
tileLayer.addTo(map);

function addPopupField(container, label, value) {
    if (!value) return;

    const field = document.createElement("p");
    const labelElement = document.createElement("strong");
    labelElement.textContent = `${label}: `;
    field.append(labelElement, document.createTextNode(value));
    container.append(field);
}

function createPopup(properties) {
    const popup = document.createElement("div");
    popup.className = "recording-popup";

    const name = document.createElement("h2");
    name.textContent = guessingMode && !recordingRevealed
        ? "Mystery Bird"
        : properties["Common Name"] || "Bird recording";
    popup.append(name);

    const showDetails = !guessingMode || recordingRevealed;
    if (showDetails) {
        addPopupField(popup, "Scientific Name", properties["Scientific Name"]);
        addPopupField(popup, "Date", properties.Date);
        addPopupField(popup, "Location", properties.Locality);
        addPopupField(popup, "Behavior", properties.Behaviors);
        addPopupField(popup, "Recorded By", properties.Recordist);
    }

    if (properties["ML Catalog Number"]) {
        if (guessingMode) {
            const player = document.createElement("audio");
            player.controls = true;
            player.preload = "none";
            player.src = `https://cdn.download.ams.birds.cornell.edu/api/v1/asset/${encodeURIComponent(properties["ML Catalog Number"])}/audio`;
            player.setAttribute("aria-label", "Mystery bird recording");
            popup.append(player);

            if (!recordingRevealed) {
                const revealButton = document.createElement("button");
                revealButton.className = "reveal-bird";
                revealButton.type = "button";
                revealButton.textContent = "Reveal Bird";
                revealButton.addEventListener("click", (event) => {
                    event.stopPropagation();
                    recordingRevealed = true;
                    selectedMarker?.setIcon(selectedBirdIcon);
                    renderRecording();
                });
                popup.append(revealButton);
            }
        } else {
            const player = document.createElement("iframe");
            player.src = `https://macaulaylibrary.org/asset/${encodeURIComponent(properties["ML Catalog Number"])}/embed?autoplay=true`;
            player.width = "560";
            player.height = "480";
            player.setAttribute("frameborder", "0");
            player.setAttribute("allowfullscreen", "");
            player.allow = "autoplay; fullscreen";
            player.title = `Bird recording: ${properties["Common Name"] || "bird"}`;
            popup.append(player);

            const catalogLink = document.createElement("a");
            catalogLink.href = `https://macaulaylibrary.org/asset/${encodeURIComponent(properties["ML Catalog Number"])}`;
            catalogLink.target = "_blank";
            catalogLink.rel = "noreferrer";
            catalogLink.textContent = "View Recording";
            popup.append(catalogLink);
        }
    }

    return popup;
}

function renderRecording() {
    if (selectedRecording) {
        recordingPanel.hidden = false;
        recordingPanel.replaceChildren(closeRecordingButton, createPopup(selectedRecording));
    }
}

function showRecording(properties) {
    selectedRecording = properties;
    recordingRevealed = false;
    renderRecording();
}

async function loadRecordings() {
    const response = await fetch("data/philly_bird_songs.geojson");
    if (!response.ok) {
        throw new Error(`Could not load bird recordings (${response.status} ${response.statusText})`);
    }

    const data = await response.json();
    let defaultRecording;
    const recordings = L.geoJSON(data, {
        pointToLayer: (_feature, latlng) => L.marker(latlng, { icon: birdIcon }),
        onEachFeature: (feature, layer) => {
            const properties = feature.properties || {};
            layer.on("click", () => {
                selectedMarker?.setIcon(birdIcon);
                selectedMarker = layer;
                selectedMarker.setIcon(selectedBirdIcon);
                showRecording(properties);
            });

            if (properties["ML Catalog Number"] === "422990911") {
                defaultRecording = properties;
            }
        },
    });

    const upwardSpiderfyPositions = (count, center) => {
        const positions = [];
        let remaining = count;
        let ring = 0;

        while (remaining > 0) {
            const radius = 56 + ring * 40;
            const ringCapacity = Math.max(2, Math.floor(Math.PI * radius / 36));
            const pointsInRing = Math.min(remaining, ringCapacity);

            for (let i = 0; i < pointsInRing; i++) {
                const angle = Math.PI + Math.PI * (i + 1) / (pointsInRing + 1);
                positions.push(L.point(
                    center.x + radius * Math.cos(angle),
                    center.y + radius * Math.sin(angle),
                )._round());
            }

            remaining -= pointsInRing;
            ring++;
        }

        return positions;
    };

    const clusters = L.markerClusterGroup({
        chunkedLoading: true,
        chunkInterval: 25,
        chunkDelay: 10,
        animate: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        spiderfyDistanceMultiplier: 2,
        spiderfyShapePositions: upwardSpiderfyPositions,
        zoomToBoundsOnClick: false,
        showCoverageOnHover: false,
        spiderLegPolylineOptions: { weight: 0, opacity: 0 },
    });
    clusters.on("clusterclick", (event) => {
        const sidebarWidth = mapSidebar.getBoundingClientRect().width;
        map.fitBounds(event.layer.getBounds(), {
            paddingTopLeft: [sidebarWidth + 24, 24],
            paddingBottomRight: [24, 24],
        });
    });
    let customBranches = [];
    clusters.on("spiderfied", (event) => {
        const center = event.cluster.getLatLng();
        const centerPoint = map.latLngToContainerPoint(center);
        const points = event.markers.map((marker) => map.latLngToContainerPoint(marker.getLatLng()));
        const path = [];
        let seed = (
            Math.round(center.lat * 100000) ^
            Math.round(center.lng * 100000) ^
            points.length
        ) >>> 0;
        const random = () => {
            seed = (seed + 0x6D2B79F5) >>> 0;
            let value = seed;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
        points.sort((a, b) => a.x - b.x);

        const toLatLngPair = (point) => {
            const latLng = map.containerPointToLatLng(point);
            return [latLng.lat, latLng.lng];
        };

        const addBranch = (start, end, depth) => {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy) || 1;
            const bend = Math.min(12, length * 0.08) * (depth % 2 === 0 ? 1 : -1);
            const control = [
                (start.x + end.x) / 2 - (dy / length) * bend,
                Math.min(start.y, end.y) - Math.abs((dx / length) * bend),
            ];

            path.push(
                "M", toLatLngPair(start),
                "Q", toLatLngPair(control),
                toLatLngPair(end),
            );
        };

        const buildBranch = (start, group, depth) => {
            if (group.length === 1) {
                addBranch(start, group[0], depth);
                return;
            }

            const maxGroupY = Math.max(...group.map((point) => point.y));
            const verticalGap = Math.max(1, start.y - maxGroupY);
            const node = L.point(
                group.reduce((sum, point) => sum + point.x, 0) / group.length
                    + (random() - 0.5) * Math.min(36, verticalGap * 0.45),
                start.y - verticalGap * (0.35 + random() * 0.3),
            );
            addBranch(start, node, depth);

            const minSplit = Math.max(1, Math.floor(group.length * 0.4));
            const maxSplit = Math.min(group.length - 1, Math.ceil(group.length * 0.6));
            const split = minSplit + Math.floor(random() * (maxSplit - minSplit + 1));
            buildBranch(node, group.slice(0, split), depth + 1);
            buildBranch(node, group.slice(split), depth + 1);
        };

        if (points.length) {
            buildBranch(centerPoint, points, 0);
            customBranches.push(L.curve(path, {
                color: "#c4a484",
                weight: 2.5,
                interactive: false,
            }).addTo(map));
        }
    });
    clusters.on("unspiderfied", () => {
        customBranches.forEach((branch) => map.removeLayer(branch));
        customBranches = [];
    });
    clusters.addLayer(recordings);
    map.addLayer(clusters);

    if (recordings.getBounds().isValid()) {
        const leftPadding = window.innerWidth > 600
            ? recordingPanel.getBoundingClientRect().width + 24
            : 24;
        map.fitBounds(recordings.getBounds(), {
            paddingTopLeft: [leftPadding, 24],
            paddingBottomRight: [24, 24],
        });
    }
    if (defaultRecording) {
        showRecording(defaultRecording);
    }
}

loadRecordings().catch((error) => {
    console.error(error);
    const message = document.createElement("p");
    message.className = "map-error";
    message.textContent = "Bird recordings could not be loaded. Please reload the page to try again.";
    mapElement.append(message);
});