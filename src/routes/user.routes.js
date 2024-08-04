import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccesstoken , 
        changeCurrentUserPassword, getCurrentUser, deleteWatchHistory,
        updateAccountDetails , updateUserAvatar, deleteAvatar ,
        updateUserCoverImage, getUserChannelProfile , deleteCoverImage ,
        getWatchHistory , forgetPassword , newPassword , getRegisteredUsers} from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
const router = Router()

router.route("/register").post(
    upload.fields([
        {   name : "avatar",
            maxCount : 1
        } , {
            name : "coverImage",
            maxCount : 1,
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)
router.route("/forget-password").post(forgetPassword)
router.route("/new-password").post(newPassword)

//secured routes
router.route("/logout").post(verifyJWT ,logoutUser)
router.route("/refresh-token").post(refreshAccesstoken)
router.route("/change-password").post(verifyJWT , changeCurrentUserPassword)
router.route("/current-user").get(verifyJWT , getCurrentUser)
router.route("/update-account").patch(verifyJWT , updateAccountDetails)
router.route("/update-avatar").patch(verifyJWT ,upload.single("avatar") ,updateUserAvatar)
router.route("/update-coverImage").patch(verifyJWT ,upload.single("coverImage"), updateUserCoverImage)
router.route("/c/:userName").get(verifyJWT , getUserChannelProfile)
router.route("/history").get(verifyJWT , getWatchHistory)
router.route("/delete-history").delete(verifyJWT , deleteWatchHistory)
router.route("/delete-avatar").delete(verifyJWT , deleteAvatar)
router.route("/delete-coverImage").delete(verifyJWT , deleteCoverImage)
router.route("/registered-users").get(verifyJWT , getRegisteredUsers)


export default router