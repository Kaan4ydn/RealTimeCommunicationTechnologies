using Microsoft.AspNetCore.SignalR;

namespace Webinar.Hubs
{
    public class ChatHub : Hub
    {
        private static readonly Dictionary<string, List<string>> Rooms = new Dictionary<string, List<string>>();

        // Create Rooms

        public async Task CreateRoom()
        {
            // Yeni bir room Id oluşturulur. 
            var roomId = Guid.NewGuid().ToString();

            // Odaya mevcut bağlantı ekleme.
            Rooms[roomId] = new List<string> { Context.ConnectionId };

            // Oda oluşturuldu mesajı gönderelim.
            await Clients.Caller.SendAsync("Created", roomId);

            // Mevcut bağlantının odaya katıldığını bildirelim.
            await Clients.Caller.SendAsync("Joined", roomId);
        }

        // Join Room
        public async Task JoinRoom(string roomId)
        {
            if (Rooms.ContainsKey(roomId))
            {
                Rooms[roomId].Add(Context.ConnectionId);

                // Odadaki her bağlantıya katılım bildirimi gönder.
                foreach (var connectionId in Rooms[roomId])
                {
                    await Clients.Client(connectionId).SendAsync("Joined", roomId);
                }
            }
            else
            {
                await Clients.Caller.SendAsync("Error", "Room Not Found");
            }
        }

        // Odanın hazır olduğunu bildiren metot
        public async Task Ready(string roomId)
        {
            if (Rooms.ContainsKey(roomId))
            {
                foreach (var connectionId in Rooms[roomId])
                {
                    await Clients.Clients(connectionId).SendAsync("Ready");
                }
            }
        }

        // Sinyal verilerini odadaki diğer bağlantılara ileten metot
        public async Task Signal(string roomId, object data)
        {
            if (Rooms.ContainsKey(roomId))
            {
                // Odadaki her bağlantıya sinyal yollanıyor ama sinyal yollayana sinyal yollanmıyor.
                foreach (var connectionId in Rooms[roomId])
                {
                    if (connectionId != Context.ConnectionId)
                    {
                        await Clients.Client(connectionId).SendAsync("Signal", data);
                    }
                }
            }
        }
    }
}
