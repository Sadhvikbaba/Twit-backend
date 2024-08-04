import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user._id;

    if(!userId) throw new ApiError(400 , "user id is required");

    
    const existingLike = await Like.findOne({ likedBy: userId, video: videoId });

    if (existingLike) {
        await Like.findByIdAndUpdate(existingLike._id, { video: null });
        return res.status(200).json(new ApiResponse(200 , {} , "like removed successfully"));
    } else {
        
        let like;
        const existingNullLike = await Like.findOne({ likedBy: userId, video: null });

        if (existingNullLike) {
            like = await Like.findByIdAndUpdate(existingNullLike._id, { video: videoId }, { new: true });
        } else {
            like = await Like.create({ likedBy: userId, video: videoId });
        }

        return res.status(200).json(new ApiResponse(200 , like , "like added successfully"));
    }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    const userId = req.user._id 
    
    if(!userId) throw new ApiError(400 , "user id is required");

    const exsitedLike = await Like.findOne({likedBy : userId , comment : commentId});

    if(exsitedLike){
        await Like.findByIdAndUpdate(exsitedLike._id , {comment : null});
        return res.status(200).json(new ApiResponse(200 , {} , "like removed Successfully"))
    }else {
        let like ;
        const existingNullLike = await Like.findOne({likedBy : userId , comment :null })

        if(existingNullLike){
            like = await Like.findByIdAndUpdate(existingNullLike._id , {comment : commentId} , {new : true});
        }else {
            like = await Like.create({likedBy : userId , comment : commentId})
        }

        return res.status(200).json(new ApiResponse(200 , like , "like added successfully"))
    }

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    const userId = req.user._id
    
    if(!userId) throw new ApiError(400 , "user id is required");

    const exsitedLike = await Like.findOne({likedBy : userId , tweet : tweetId});

    if(exsitedLike){
        await Like.findByIdAndUpdate(exsitedLike._id , {tweet : null});
        return res.status(200).json(new ApiResponse(200 , {} , "like removed successfully"));
    }else {
        let like ;
        const existingNullLike = await Like.findOne({likedBy : userId, tweet : null})

        if(existingNullLike){
            like = await Like.findByIdAndUpdate(existingNullLike._id , {tweet : tweetId} , {new : true})
        }else {
            like = await Like.create({likedBy : userId , tweet : tweetId})
        }
        return res.status(200).json(new ApiResponse(200 , like , "like added successfully"));
    }
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    
    const userId = req.user._id;

    const likedVideos = await Like.aggregate([
        {$match : { likedBy : new mongoose.Types.ObjectId(userId) , video : {$nin : [null] } }
        },
        {
            $lookup : {
                from : "videos",
                localField : "video",
                foreignField :"_id",
                as : "videoDetails",
            }
        },{
            $unwind : "$videoDetails"
        },{
            $project : {
                thumbnail : "$videoDetails.thumbnail",
                title : "$videoDetails.title",
                duration : "$videoDetails.duration",
                views : "$videoDetails.views",
                _id :"$videoDetails._id"
            }
        }
    ])

    if(!likedVideos) throw new ApiError(500 , "error while fetching liked videos");

    return res.status(200).json(new ApiResponse(200 , likedVideos , "liked videos fetched successfully"))

})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}