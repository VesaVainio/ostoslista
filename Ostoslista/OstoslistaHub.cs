using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Microsoft.AspNet.SignalR;
using System.Threading.Tasks;

namespace Ostoslista
{
    public class OstoslistaHub : Hub
    {
        public async Task JoinList(string listId)
        {
            await Groups.Add(Context.ConnectionId, listId);
            Clients.OthersInGroup(listId).SendUpdates();
        }

        public Task LeaveList(string listId)
        {
            return Groups.Remove(Context.ConnectionId, listId);
        }
        
        public void BroadcastListUpdate(string listId, string whoUpdated, int itemId)
        {
            Clients.OthersInGroup(listId).ListUpdated(listId, whoUpdated, DateTime.UtcNow.ToLongTimeString(), itemId);
        }

        public void BroadcastItemUpdated(string listId, string whoUpdated, int itemId)
        {
            Clients.OthersInGroup(listId).ItemUpdated(listId, whoUpdated, DateTime.UtcNow.ToLongTimeString(), itemId);
        }

        public void BroadcastItemsDeleted(string listId, string whoUpdated)
        {
            Clients.OthersInGroup(listId).ItemsDeleted(listId, whoUpdated, DateTime.UtcNow.ToLongTimeString());
        }

        public void BeginListItemUpdating(string listId, int itemId, string whoUpdating)
        {
            Clients.OthersInGroup(listId).BeginListItemUpdating(itemId, whoUpdating, DateTime.UtcNow.ToLongTimeString());
        }

        public void EndListItemUpdating(string listId, int itemId)
        {
            Clients.OthersInGroup(listId).EndListItemUpdating(itemId);
        }

    }
}