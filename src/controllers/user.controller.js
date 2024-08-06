import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js";
import {uploadOnCloudinary , deleteFileByUrl} from "../utils/cloudinary.js";
import mongoose from "mongoose";
import { User } from "../models/User.models.js";
import {Subscription} from "../models/subscription.models.js"
import jwt from "jsonwebtoken";
import {sendMail} from "../utils/mail.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken 

        await user.save({validateBeforeSave : false})

        return {accessToken , refreshToken}

    } catch (error) {
        throw new ApiError(500 , "someThing went wrong")
    }
}

const registerUser = asyncHandler( async (req , res) => {

    // get details from frontend
    // validation : not empty
    // check if user already exists or not : username and email
    // check for images , avatar
    // create user , entry in db
    // remove password and refresh token from response
    // check for user creation 
    // return user

    const {userName , email , fullName , password} = req.body

    if([userName , email , fullName , password].some((field) => field?.trim() === "")){
        throw new ApiError(400 , "all fields are required")
    }

    console.log(userName , email , fullName , password);

    const existeduser = await User.findOne({
        $or : [{userName} , {email} ]
    })

    if(existeduser) throw new ApiError(409 , "User already exists");


    let avatarLocalPath = null;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0){
        avatarLocalPath = req.files.avatar[0].path;
    }

    let coverImageLocalPath = null;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);


    const user = await User.create({
        fullName : fullName ,
        email : email,
        avatar : avatar?.url || "" ,
        coverImage : coverImage?.url || "",
        password : password,
        userName : userName.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -OTP"
    )

    if(!createdUser) throw new ApiError(500 , "something went wrong while registering the user");

    //sendMail(email , "account created successfully");

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered successfully")
    );
})

const loginUser = asyncHandler(async (req, res) => {
    // get details from frontend
    // email and password
    // find does user exist
    //password check
    //access and refresh token
    // send cookies

    const { email, password } = req.body;

    if (!(email && password)) throw new ApiError(400, "Email and password are required");

    const userDetails = await User.findOne({ email });

    if (!userDetails) throw new ApiError(404, "User does not exist");

    const isPasswordValid = await userDetails.isPasswordCorrect(password);

    if (!isPasswordValid) throw new ApiError(401, "Password is incorrect");

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(userDetails._id);

    const loggedInUser = await User.findById(userDetails._id).select("-password -refreshToken -OTP");

    const accessTokenOptions = { httpOnly: true, secure: true, sameSite: 'None' };
    const refreshTokenOptions = { httpOnly: true, secure: true, sameSite: 'None' };

    res.cookie("refreshToken", refreshToken, refreshTokenOptions);
    res.cookie("accessToken", accessToken, accessTokenOptions);

    return res.status(200).json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully..."));
});

const logoutUser = asyncHandler( async(req , res) => {
    const id = req.user._id
    User.findByIdAndUpdate(id , {$set : { refreshToken : undefined }} , {new : true})

    const options = {httpOnly : true , secure : true}

    return res.status(200).clearCookie("accessToken" , options).clearCookie("refreshToken" , options).
    json(new ApiResponse(200 , {} , "user logged out"))

})

const refreshAccesstoken = asyncHandler( async(req , res) =>{
    const token = req.cookies.refreshToken || req.body.refreshToken

    try {
        if(!token) throw new ApiError(401 , "unauthorized user");
    
        const decodedtoken =  jwt.verify(token , process.env.REFRESH_TOKEN_SECRET);
    
        if(!decodedtoken) throw new ApiError(401 , "unauthorized user");
    
        const user = await User.findById(decodedtoken._id);
    
        if(!user) throw new ApiError(401 , "invalid refresh token");
    
        if(user.refreshToken != token) throw new ApiError(401 , "refresh token is expired");
    
        const options = {httpOnly : true , secure : true };
    
        const {accessToken , refreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res.status(200).cookie("refreshToken" , refreshToken , options).cookie("accessToken" , accessToken , options)
        .json(new ApiResponse(200 , {accessToken , refreshToken} , "access token refreshed"))

    } catch (error) {
        throw new ApiError(500 , "something went wrong");
    }
})

const changeCurrentUserPassword = asyncHandler( async(req , res) => {
    const {oldPassword , newPassword} = req.body

    const user = await User.findById(req.user._id);

    const isCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isCorrect) throw new ApiError(400 , "password is incorrect")

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res.status(200).json( new ApiResponse(200 , {} , "Password changed successfully"));
})

const getCurrentUser = asyncHandler(async (req , res) => {
    return res.status(200).json(new ApiResponse(200 , req.user , " current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req , res) =>{
    const {fullName , email} = req.body

    if(!fullName || ! email) throw new ApiError(400 , "all fields are required");

    const user = await User.findByIdAndUpdate(req.user._id,
        {$set : {fullName , email }},{new : true}
    ).select("-password")

    return res.status(200).json( new ApiResponse(200 , user , "Account details updated successfully"));
})

const updateUserAvatar = asyncHandler(async (req , res) =>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) throw new ApiError(400 , "avatar file is missing")

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) throw new ApiError(500 , "Error while uploading on avatar");

    const findUser = await User.findById(req.user._id);

    if(!findUser) throw new ApiError(401 , "unauthorized user");

    const user = await User.findByIdAndUpdate(req.user?._id , {$set : {avatar : avatar.url}} , {new : true}).select("avatar");

    if(user && findUser.avatar != "") await deleteFileByUrl(findUser.avatar);

    return res.status(200).json( new ApiResponse(200 , {user} , "avatar updated successfully"));
})

const updateUserCoverImage = asyncHandler(async (req , res) =>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) throw new ApiError(400 , "coverImage file is missing")

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) throw new ApiError(500 , "Error while uploading on coverImage");

    const findUser = await User.findById(req.user._id);

    const user = await User.findByIdAndUpdate(req.user?._id , {$set : {coverImage : coverImage.url}} , {new : true}).select("coverImage");

    if(user && findUser.coverImage !="") await deleteFileByUrl(findUser.coverImage);

    return res.status(200).json( new ApiResponse(200 , {user} , "coverImage updated successfully"));
})

const getUserChannelProfile = asyncHandler(async (req , res) => {
    const {userName} = req.params

    if(! userName.trim()) throw new ApiError(400 , "username is missing")

    const channel = await User.aggregate([
        {
            $match: {userName : userName?.toLowerCase()}
        },
        {
            $lookup : {
                from : "subscriptions" ,
                localField : "_id" ,
                foreignField : "channel",
                as : "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions" ,
                localField : "_id" ,
                foreignField : "subscriber" ,
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount  : {$size : "$subscribers"},
                subscribedToCount : {$size : "$subscribedTo"},
                isSubscribed : {
                    $cond : {
                        if : {$in : [req.user?._id , "$subscribers.subscriber"]},
                        then : true,
                        else : false ,
                    }}
            }
        },
        {
            $project :{
                fullName : 1,
                userName : 1,
                avatar : 1,
                coverImage : 1 ,
                email : 1,
                subscribersCount : 1,
                subscribedToCount : 1,
                isSubscribed : 1,
            }
        }
    ]);

    if(!channel?.length) throw new ApiError(404 , "channel does not exist");

    return res.status(200).json(new ApiResponse(200 , channel[0] , "user channel fetched successfully"));
})

const getWatchHistory  = asyncHandler(async (req , res) => {
    const  user = await User.aggregate([
        {
            $match : { _id : new mongoose.Types.ObjectId(req.user._id)}
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as : "watchHistory",
                pipeline :[
                    {
                        $lookup :{
                            from : "users" ,
                            localField : "owner",
                            foreignField : "_id" ,
                            as : "owner",
                            pipeline : [
                                {
                                    $project : {
                                        userName : 1,
                                    }
                                }
                            ]
                        }
                    },{
                        $addFields : {owner : {$first : "$owner"}}
                    },{
                        $project : {
                            thumbnail : 1,
                            duration : 1,
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(
        new ApiResponse(200 , user[0]?.watchHistory , "watch history fetched successfully")
    )
})

const deleteWatchHistory = asyncHandler(async (req , res) => {
    const user = req.user._id;

    const history = await User.findByIdAndUpdate(user , {$set : {watchHistory : []}} , {new : true});

    if(!history)throw new ApiError(500 , "error while deleting watch history");

    res.status(200).json(new ApiResponse(200 , history.watchHistory , "history deleted successfully"))
})

const deleteAvatar = asyncHandler(async(req,res) =>{
    const user = req.user._id;

    const findUser = await User.findById(user);

    if(!findUser) throw new ApiError(400 , "user not found");

    const updatedUser = await User.findByIdAndUpdate(user , {$set : {avatar : ""}} , {new : true});

    if(!updatedUser) throw new ApiError(500 , "error while updating details");

    await deleteFileByUrl(findUser.avatar);

    return res.status(200).json(new ApiResponse(200 , {} , "avatar deleted successfully"));

})

const deleteCoverImage = asyncHandler(async(req,res) =>{
    const user = req.user._id;

    const findUser = await User.findById(user);

    if(!findUser) throw new ApiError(400 , "user not found");

    const updatedUser = await User.findByIdAndUpdate(user , {$set : {coverImage : ""}} , {new : true});

    if(!updatedUser) throw new ApiError(500 , "error while updating details");

    await deleteFileByUrl(findUser.coverImage);

    return res.status(200).json(new ApiResponse(200 , {} , "cover image deleted successfully"));

})

const forgetPassword = asyncHandler(async(req , res)=>{
    const {email} = req.body;
    const user = await User.findOne({email});
    
    if(!user) throw new ApiError(400 , "user with email not found");

    const OTP = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000

    const updatedUser = await User.findByIdAndUpdate(user._id , {$set : {OTP : OTP}} , {new : true});

    if(!updatedUser || updatedUser.OTP.length==0)throw new ApiError(500 , "error while generating OTP");

    sendMail(email , `The OTP for your account is ${OTP} please do not share this to any one`);

    res.status(200).json(new ApiResponse(200 , {} , "check your mail for OTP"));
})

const newPassword = asyncHandler(async(req,res)=>{
    const {email , password , OTP} = req.body;

    const user = await User.findOne({email : email});

    if(!user)throw new ApiError(400 , "user not found");

    if(user.OTP != OTP){
        await User.findByIdAndUpdate(user._id , {$set : { OTP : ""}} , {new : true})
        throw new ApiError(400 , "OTP is wrong generate again to continue")
    }

    user.password = password
    user.OTP = ""
    
    await user.save({validateBeforeSave : false})

    return res.status(200).json( new ApiResponse(200 , {} , "Password changed successfully"));
})

const getRegisteredUsers = asyncHandler(async(req,res)=>{
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const isSubscribed = async (userId, owner) => {
        const response = await Subscription.findOne({ subscriber : userId , channel: owner });
        return response ? true : false;
    }

    const users = await User.aggregate([
        { $skip: (pageNumber - 1) * limitNumber },
        { $limit: limitNumber },
        {$project : {
            userName : 1,
            avatar : 1
        }}
    ])

    if(!users) throw new ApiError(500 , "error while fetching users");

    const processedUsers = await Promise.all(users.map(async (user) => {
        const subscribed = await isSubscribed(userId, user._id);
        return {
            ...user,
            isSubscribed: subscribed
        };
    }));

    res.status(200).json(new ApiResponse(200 , processedUsers , "users fetched successfully"))
})

export {registerUser , loginUser , logoutUser , refreshAccesstoken , deleteCoverImage,forgetPassword,
    changeCurrentUserPassword , getCurrentUser , updateAccountDetails ,deleteAvatar, newPassword,
    updateUserAvatar , updateUserCoverImage , getUserChannelProfile , getWatchHistory , deleteWatchHistory , getRegisteredUsers
}
