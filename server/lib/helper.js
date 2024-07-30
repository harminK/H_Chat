import app from "../app.js";

const getOtherMember = (member, userId) => {
  return member.find((member) => member._id.toString() !== userId.toString());
};

const getSockets = (user = []) => {
  const sockets = user.map((users) => app.userSocketIds.get(users.toString()));

  return sockets;
};

const getBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
};

export default { getOtherMember, getSockets, getBase64 };
