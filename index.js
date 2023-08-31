const express = require('express');
const app = express();
const cors = require('cors')
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

app.use(cors())

app.get('/', (req, res) => {
  res.send('<h1>Hey, this is the Socket-Server to handel all the Socket.io related shit.</h1>');
});

const usersInRoom = {};  //roomId -> [users socketIds]

const socketToRoom = {}; //socketId -> roomID

io.on('connection', (socket) => {
    console.log('A new user got connected!', socket.id);

    //make the user join the room
    socket.on("join_room", (data) => {
      //join the room
      console.log("asshole",socket.id, "trying to join", data);
      socket.join(data.roomid);
      console.log(`User with ID: ${socket.id} joined room: ${data.roomid}`);
      //notify every1 in the room
      socket.to(data.roomid).emit("notify-join", data);
      console.log("notification sent!")
      //new code--------------------------------------------------------------------------------
      if (usersInRoom[data.roomid]) {
        const length = usersInRoom[data.roomid].length;
        if (length === 100) {
            socket.emit("room is full");
            return;
        }
        usersInRoom[data.roomid].push(socket.id);
      } else {
          usersInRoom[data.roomid] = [socket.id];
      }
      socketToRoom[socket.id] = data.roomid;
      const allusersInThisRoom = usersInRoom[data.roomid].filter(id => id !== socket.id);
      //send all the socketIds of users who are already in the room to the newly connected user
      socket.emit("all_usersInRoom", allusersInThisRoom);
      console.log('All users already in the room are', allusersInThisRoom)
    });

    //broadcast the msg to every1 in the room when the user sends a msg
    socket.on("send_msg", (data) => {
      socket.to(data.roomid).emit("receive_msg", data);
      console.log("msg sent!")
    });

    //WebRTC Events-------------------------------------------------------------------
    
    //make a call to the other user
    socket.on("sending_signal", (data) => {
      io.to(data.userToSignal).emit('user_joined', { signal: data.signal, callerID: data.callerID });
    });

    //send the call response to the other user 
    socket.on("returning_signal", (data) => {
        io.to(data.callerID).emit('receiving_returned_signal', { signal: data.signal, id: socket.id });
    });

    //-------------------------------------------------------------------------------- 
    //what to do when the user is disconnected 
    socket.on('disconnect', () => {
      //notify every1 in the room
      const roomID = socketToRoom[socket.id];
      socket.to(roomID).emit("notify-left", socket.id);
      console.log('motherfucker,',socket.id,' got disconnected');
      //new code-------------------------------------------------------------------------------
      let allCurrUsers = usersInRoom[roomID];
      if (allCurrUsers) {
        //remove the disconnected user from the usersInRoom HashMap
        allCurrUsers = allCurrUsers.filter(id => id !== socket.id);
        usersInRoom[roomID] = allCurrUsers;
      }
      console.log('users in the room', roomID, 'are', usersInRoom[roomID])
    });
});

server.listen(3001, () => {
  console.log('Socket Server is listening on :3001');
});