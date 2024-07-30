import mongoose from "mongoose";
import JWT from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import helper from "../lib/helper.js";

//create a mongoDB connection
const createDBConnection = async () => {
  return await mongoose.connect(process.env.DATA_BASE_URL);
};

const cookieOptiones = {
  maxAge: 15 * 24 * 60 * 60 * 1000,
  sameSite: "none",
  httpOnly: true,
  secure: true,
};

// Create a JWT token and send the cookies
const sendToken = (res, user, code, message) => {
  const token = JWT.sign({ _id: user._id }, process.env.JWT_KEY);

  return res
    .status(code)
    .cookie("whatsapp-token", token, cookieOptiones)
    .json({ status: true, message });
};

const emitE = (req, event, users, data) => {
  console.log("emit eee", event);
};

const uploadFilesToCloudeinary = async (files = []) => {
  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        helper.getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid(),
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);

    const formattedResults = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));
    return formattedResults;
  } catch (err) {
    throw new Error("Error uploading files to cloudinary", err);
  }
};

const deleteFilesFromCludeinary = async (public_ids) => {
  //deleteFile from cludinary
};

export default {
  createDBConnection,
  sendToken,
  cookieOptiones,
  emitE,
  deleteFilesFromCludeinary,
  uploadFilesToCloudeinary,
};
