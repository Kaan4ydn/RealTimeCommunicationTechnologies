

const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://realtimeaudioandvideocall20240727131611.azurewebsites.net/chatHub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

let localStream;
let localPeerConnection;
let remotePeerConnection;
let roomId;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const createRoomButton = document.getElementById('createRoom');
const joinRoomButton = document.getElementById('joinRoom');
const roomIdInput = document.getElementById('roomIdInput');

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    }).catch(error => {
        console.error('Error accessing media devices.', error);
    });

connection.on("Created", (room) => {
    roomId = room;
    roomIdInput.value = room;
    console.log("Created room " + room);
});

connection.on("Joined", (room) => {
    console.log("Joined room " + room);
    if (room === roomId) {
        createPeerConnectionsAndAddStream();
        connection.invoke("Ready", roomId).catch(err => console.error(err));
    }
});

connection.on("Ready", async () => {
    if (localPeerConnection && localPeerConnection.signalingState !== "stable") {
        console.warn("PeerConnection not in stable state when receiving Ready");
        return;
    }

    localPeerConnection.createOffer()
        .then(offer => localPeerConnection.setLocalDescription(offer))
        .then(() => {
            connection.invoke("Signal", roomId, { 'type': 'offer', 'sdp': localPeerConnection.localDescription.sdp })
                .catch(err => console.error(err));
        }).catch(err => console.error('Error creating offer:', err));
});

connection.on("Signal", async (message) => {
    if (message.type === 'offer') {
        if (remotePeerConnection && remotePeerConnection.signalingState !== "stable") {
            console.warn("PeerConnection not in stable state when receiving offer");
            return;
        }

        remotePeerConnection.setRemoteDescription(new RTCSessionDescription(message))
            .then(() => remotePeerConnection.createAnswer())
            .then(answer => remotePeerConnection.setLocalDescription(answer))
            .then(() => {
                connection.invoke("Signal", roomId, { 'type': 'answer', 'sdp': remotePeerConnection.localDescription.sdp })
                    .catch(err => console.error(err));
            }).catch(err => console.error('Error handling offer:', err));
    } else if (message.type === 'answer') {
        if (localPeerConnection && localPeerConnection.signalingState !== 'have-local-offer') {
            console.warn("PeerConnection not in 'have-local-offer' state when receiving answer");
            return;
        }

        localPeerConnection.setRemoteDescription(new RTCSessionDescription(message))
            .catch(err => console.error('Error setting remote description:', err));
    } else if (message.type === 'candidate') {
        const candidate = new RTCIceCandidate(message.candidate);
        const peerConnection = localPeerConnection.signalingState === 'stable' ? localPeerConnection : remotePeerConnection;
        peerConnection.addIceCandidate(candidate)
            .catch(err => console.error('Error adding received ICE candidate:', err));
    }
});

connection.start().catch(err => console.error('Error starting SignalR connection:', err));

createRoomButton.addEventListener('click', () => {
    connection.invoke("CreateRoom").catch(err => console.error(err));
});

joinRoomButton.addEventListener('click', () => {
    const roomIdToJoin = roomIdInput.value;
    roomId = roomIdToJoin;
    connection.invoke("JoinRoom", roomIdToJoin).catch(err => console.error(err));
});

function createPeerConnectionsAndAddStream() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' } 
        ]
    };

    localPeerConnection = new RTCPeerConnection(configuration);
    remotePeerConnection = new RTCPeerConnection(configuration);

    localPeerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            connection.invoke("Signal", roomId, { 'type': 'candidate', 'candidate': candidate })
                .catch(err => console.error(err));
        }
    };

    remotePeerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            connection.invoke("Signal", roomId, { 'type': 'candidate', 'candidate': candidate })
                .catch(err => console.error(err));
        }
    };

    remotePeerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => localPeerConnection.addTrack(track, localStream));
}