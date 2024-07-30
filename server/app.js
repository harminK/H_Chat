import morgan from "morgan";
import dotenv from "dotenv";
import express from "express";
import features from "./utils/features.js";
import chatRoutes from "./routes/chat.routes.js";
import userRouter from "./routes/user.routes.js";
import err from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import adminRoute from "./routes/admin.routes.js";
import { Server } from "socket.io";
import { createServer } from "http";
import event from "./constants/event.js";
import { v4 } from "uuid";
import helper from "./lib/helper.js";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import auth from "./middlewares/auth.js";
// import user from "./seeder/user.js";

const app = express();
const userSocketIds = new Map();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:4173",
      process.env.CLIENT_URL,
    ],
    credentials: true,
  })
);

app.use(morgan("dev"));

dotenv.config({
  path: "./.env",
});

app.use("/api/v1/user", userRouter);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/admin", adminRoute);

features
  .createDBConnection()
  .then(() => {
    console.log("Connected to MongoDB.");
  })
  .catch((error) => {
    console.log("Unable to connect to MongoDB.");
    console.log(error);
  });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// user.createUser(10);
// user.createSingleChats(10);
// user.createGroupChats(10);
// user.createMessagesInAChat("66814ee64ce2bc8fc759eac1",50)

const server = createServer(app);
const io = new Server(server, {
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    process.env.CLIENT_URL,
  ],
  credentials: true,
});

io.use((socket, next) => {
  cookieParser()(socket.request, socket.request.res, async (err) => {
    await auth.socketAuthenticater(err,socket,next);
  });
});

io.on("connection", (socket) => {
  
  const userss = socket.user;
  const user = {
    _id: "keval",
    name: "maro roj le",
  };

  userSocketIds.set(user._id.toString(), socket.id);

  socket.on(event.NEW_MESSAGE, async ({ chatId, member, message }) => {
    const messageForRealTime = {
      content: message,
      _id: v4(),
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toString(),
    };

    const messageForDb = {
      content: message,
      sender: user._id,
      chat: chatId,
    };

    const memberSocket = helper.getSockets(member);

    io.to().emit(event.NEW_MESSAGE, {
      chatId,
      message: messageForRealTime,
    });
    io.to(memberSocket).emit(event.NEW_MESSAGE_ALERT, { chatId });

    console.log("NEW_MESSAGE", messageForRealTime);
  });

  console.log("a user connected", socket.id);
  socket.on("disconnect", () => {
    console.log("user disconnected");
    userSocketIds.delete(user._id.toString());
  });
});

app.use(err.erromiddleware);

app.get("/", (req, res) => {
  res.send("Hello From a Home");
});

server.listen(process.env.PORT, () => {
  console.log(
    `Server is runing on port ${
      process.env.PORT
    } in ${process.env.NODE_ENV.trim()}`
  );
});

export default { userSocketIds };
