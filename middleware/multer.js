import multer from "multer";

const storage = multer.memoryStorage();

// Single upload for profile picture
export const singleUpload = multer({ 
  storage}).single("profilePic"); // Field name: profilePic

// Multiple upload upto 5 images
export const multipleUpload = multer({ 
  storage,}).array("files", 5);