import { compare } from "bcrypt";
import Users from "../models/user.js";
import HTTP from "./httpStatusCode.js";
import err from "../middlewares/error.js";
import features from "../utils/features.js";
import ErrorHandler from "../utils/utilits.js";
import Requests from "../models/request.js";
import Chats from "../models/chat.js";
import event from "../constants/event.js";
import getOtherMember from "../lib/helper.js";

//User login
const login = err.tryCa(async (req, res, next) => {
  const { username, password } = req.body;

  
  const user = await Users.findOne({ username }).select("+password");
  
  if (!user) {
    return next(
      new ErrorHandler(HTTP.NOT_FOUND, "Invalied Username or Password")
    );
  }

  const meatchPassword = await compare(password, user.password);

  if (!meatchPassword) {
    return next(
      new ErrorHandler(HTTP.NOT_FOUND, "Invalied Username or Password")
    );
  }

  features.sendToken(res, user, HTTP.SUCCESS, "User Login Successs Fully");
});
// Creating  new User and save cookie
const newUsers = err.tryCa(async (req, res) => {
  const { name, username, password, bio } = req.body;

  const file = req.file;

  if (!file) {
    return next(new ErrorHandler(HTTP.BAD_REQUEST, "Please uplode avatar"));
  }

  const result = await features.uploadFilesToCloudeinary([file]);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };

  const user = await Users.create({
    name,
    bio,
    username,
    password,
    avatar,
  });

  // Creat a JWT token and cookie
  features.sendToken(res, user, HTTP.CREATED, "User Created Successs Fully");
});

const getMyProfile = err.tryCa(async (req, res) => {
  const user = await Users.findById(req.user);

  if (!user) {
    return next(new ErrorHandler(HTTP.NOT_FOUND, "User not found"));
  }

  res.status(HTTP.SUCCESS).json({
    success: true,
    message: user,
  });
});

const logOut = (req, res) => {
  res
    .status(HTTP.SUCCESS)
    .cookie("whatsapp-token", "", { ...features.cookieOptiones, maxAge: 0 })
    .json({
      success: true,
      message: "Logout Success fully",
    });
};

const serachUser = err.tryCa(async (req, res, next) => {
  const { name = "" } = req.body;

  // finding all my chats
  const myChats = await Chats.find({
    groupchat: false,
    member: req.user,
  });

  // extracting all users from my chats means friends or people i have chatted with
  const allUsersFromMyChats = myChats.flatMap((i) => i.member);

  // finding all users except me and my friend
  const allUserExceptMeAndFriends = await Users.find({
    _id: { $nin: allUsersFromMyChats }, // allUsersFromMyChats.concat(req.user)
    name: { $regex: name, $options: "i" },
  });

  // modifying the response
  const users = allUserExceptMeAndFriends.map(({ _id, name, avatar }) => ({
    _id,
    name,
    avatar: avatar.url,
  }));

  return res.status(HTTP.SUCCESS).json({
    success: true,
    message: users,
  });
});

const sendFriendRequest = err.tryCa(async (req, res, next) => {
  const { userId } = req.body;

  const request = await Requests.findOne({
    $or: [
      { sender: req.user, receiver: userId },
      { sender: userId, receiver: req.user },
    ],
  });

  if (request) {
    return next(new ErrorHandler(HTTP.BAD_REQUEST, "Request already sent"));
  }

  await Requests.create({
    sender: req.user,
    receiver: userId,
  });

  features.emitE(req, event.NEW_REQUEST, [userId]);

  return res.status(HTTP.SUCCESS).json({
    success: true,
    message: "Friend Request Sent",
  });
});

const acceptFriendRequest = err.tryCa(async (req, res, next) => {
  const { requestId, accept } = req.body;

  const request = await Requests.findById(requestId).populate("sender", "name");

  if (!request) {
    return next(new ErrorHandler(HTTP.NOT_FOUND, "Request not found"));
  }

  if (request.receiver._id.toString() !== req.user.toString()) {
    return next(
      new ErrorHandler(
        HTTP.UNAUTHORIZED,
        "You are not authorized to accept this request"
      )
    );
  }

  if (!accept) {
    await request.deleteOne();

    return res.status(HTTP.SUCCESS).json({
      success: true,
      message: "Friend Request Rejected",
    });
  }

  const member = [request.sender._id, request.receiver._id];

  await Promise.all([
    Chats.create({
      member,
      name: `${request.sender._id} - ${request.receiver._id}`,
    }),
    request.deleteOne(),
  ]);

  features.emitE(req, event.REFETCH_CHATS, member);

  return res.status(HTTP.SUCCESS).json({
    success: true,
    message: "Friend Request Accepted",
    senderId: request.sender._id,
  });
});

const getMyNotifications = err.tryCa(async (req, res, next) => {
  const request = await Requests.find({
    receiver: req.user,
  }).populate("sender", "name avatar");

  const allRequest = request.map(({ _id, sender }) => ({
    _id,
    sender: {
      _id: sender._id,
      name: sender.name,
      avatar: sender.avatar.url,
    },
  }));

  return res.status(HTTP.SUCCESS).json({
    success: true,
    message: allRequest,
  });
});

const getMyFriend = err.tryCa(async (req, res, next) => {
  const chatId = req.query.chatId;

  const chat = await Chats.find({
    member: req.user,
    groupchat: false,
  }).populate("member", "name avatar");

  const friend = chat.map((chats) => {
    const otherUser = getOtherMember(chats.member, req.user);

    return {
      _id: otherUser._id,
      name: otherUser.name,
      avatar: otherUser.avatar.url,
    };
  });

  if (chatId) {
    const chat = await Chats.findById(chatId);

    const availableFriends = friend.filter(
      (friends) => !chat.member.includes(friends._id)
    );

    return res.status(HTTP.SUCCESS).json({
      success: true,
      friends: availableFriends,
    });
  } else {
    return res.status(HTTP.SUCCESS).json({
      success: true,
      friend,
    });
  }
});

export default {
  login,
  newUsers,
  getMyProfile,
  logOut,
  serachUser,
  sendFriendRequest,
  acceptFriendRequest,
  getMyNotifications,
  getMyFriend,
};
