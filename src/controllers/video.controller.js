import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {Like} from "../models/like.models.js";
import {Playlist} from "../models/playlist.models.js"
import { Comment } from "../models/comment.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary , deleteFileByUrl} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = 'createdAt', sortType = 'desc', userId } = req.query;
  
  
  const match = {isPublished : true};

  
  if (query) {
      match.title = { $regex: query, $options: 'i' }; 
  }

  
  if (userId) {
      let user = await User.findOne({userName : userId.toLowerCase()})

      if(!user) return res.status(200).json(new ApiResponse(200 , {} , "no videos available"))

      let id = user._id

      match.owner = new mongoose.Types.ObjectId(id);
  }

  
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  
  const skip = (pageNumber - 1) * limitNumber;

  
  const sort = {};
  if (sortBy && sortType) {
      sort[sortBy] = sortType === 'asc' ? 1 : -1;
  }

  
  const totalDocuments = await Video.countDocuments(match);

  
  const videos = await Video.find(match)
      .sort(sort)
      .skip(skip)
      .limit(limitNumber)
      .select('thumbnail title duration views createdAt') 
      .exec();

  res.status(200).json(new ApiResponse(200, {
      videos,
      pagination: {
          totalDocuments,
          totalPages: Math.ceil(totalDocuments / limitNumber),
          currentPage: pageNumber
      }
  }, "Videos fetched successfully"));
})


const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description, isPublished = true} = req.body
    

    if(!title) throw new ApiError(400 , "title is required");
    if(!description) throw new ApiError(400 , "description is required");

    const owner = req.user._id;

    if(!owner) throw new ApiError(401 , "unauthorized user");

    let videoFileLocalPath = null;
    if(req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0){
        videoFileLocalPath = req.files.videoFile[0].path;
    }
    
    let thumbnailLocalPath = null;
    if(req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0){
        thumbnailLocalPath = req.files.thumbnail[0].path;
    }

    if(!videoFileLocalPath) throw new ApiError(401 , "video is required") ;
    if(!thumbnailLocalPath) throw new ApiError(401 , "thumbnail is required") ;

    const videoFile = await uploadOnCloudinary(videoFileLocalPath) ;
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath) ;

    if(!videoFile) throw new ApiError(500 , "error while uploading video") ;
    if(!thumbnail)throw new ApiError(500 , "error while uploading thumbnail");

    

    const duration = videoFile.duration;

    const uploadedVideo = await Video.create({
        videoFile : videoFile.url, thumbnail :thumbnail.url, description, title, duration , owner,isPublished
    })

    const createdVideo = await Video.findById(uploadedVideo._id)

    if(!createdVideo) throw new ApiError(500 , "something went wrong while uploading the video");

    return res.status(201).json(
        new ApiResponse(200 , createdVideo , "video uploaded successfully")
    );
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    const validId = isValidObjectId(videoId)

    if(!validId) throw new ApiError(400 , "video Id must be valid");

    const findVideo = await Video.findById(videoId);
    if(!findVideo) throw new ApiError(400 , "video not found")

    const user = await User.findById(req.user?._id)

    if (!user) throw new ApiError(404, "User not found");

    let watchHistory = user.watchHistory || [];

    watchHistory.unshift(videoId)

    const uniqueArray = watchHistory.filter((item, pos) => watchHistory.indexOf(item) === pos);

    watchHistory = uniqueArray;

    // Ensure the array length does not exceed 10
    if (watchHistory.length > 10) {
      watchHistory = watchHistory.slice(0, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { watchHistory: watchHistory } },
        { new: true }
    );  

    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $inc: { views: 0.5 } },
      { new: true }
  );

  const comments = await Comment.aggregate([
        { $match: { videoId: new mongoose.Types.ObjectId(videoId) } },
        { $group: { _id: null, totalComments: { $sum: 1 } } }
    ]);
  const totalComments = comments[0]?.totalComments || 0;  


  const liked = await Like.findOne({likedBy :user._id , video : videoId})


  const isliked = liked ? true : false

  const likes = await Like.aggregate([
    { $match: {video : new mongoose.Types.ObjectId(videoId) } },
    { $group: { _id: null, totalLikes: { $sum: 1 } } }
  ]);
  const totalLikes =  likes[0]?.totalLikes || 0;

    //console.log(videoId);
    const video = await Video.aggregate([
        {
          $match: { _id: new mongoose.Types.ObjectId(videoId) }
        },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
              {
                $project: {
                  userName: 1,
                  avatar: 1
                }
              }
            ]
          }
        },
        {
          $addFields: {
            owner: { $first: "$owner" },
            watchHistory : updatedUser.watchHistory,
            isLiked :isliked,
            totalLikes : totalLikes,
            totalcomments : totalComments,
          }
        }
    ]);

    return res.status(200).json(new ApiResponse(200 , video[0], "video fetched successfully"));
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const owner = req.user._id
    
    const {title , description}= req.body
    const file = req.file?.path || null

    let video = Video.findById(videoId);
    
    if(video.owner.toString() != owner.toString()) throw new ApiError(400 , "unauthorized")

    let thumbnail = null;
    if(file){
      thumbnail = await uploadOnCloudinary(file);

      if(thumbnail) await deleteFileByUrl(video.thumbnail);

      video = await Video.findByIdAndUpdate(videoId , {$set : {thumbnail : thumbnail.url}} , {new : true})
    }
    if(title)video =  await Video.findByIdAndUpdate(videoId , {$set : {title}} , {new : true});
    if(description)video =  await Video.findByIdAndUpdate(videoId , {$set : {description}} , {new : true});

    if(!video) throw new ApiError(500 , "error while updating");

    return res.status(200).json(new ApiResponse(200 , video , "video updated successfully"))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    const video = await Video.findById(videoId);

    if(!video) throw new ApiError(404 , "video not found");

    const commentResult = await Comment.deleteMany({videoId : new mongoose.Types.ObjectId(videoId)});

    if(!commentResult)throw new ApiError(500 , "error while deleting video comments");

    const likeResult = await Like.updateMany({video : new mongoose.Types.ObjectId(videoId)} , {$set : {video : null}});

    if(!likeResult) throw new ApiError(500 , "error while deleting video likes");

    const playlistResult = await Playlist.updateMany({videos : new mongoose.Types.ObjectId(videoId)} , {$pull : {videos : videoId}})

    if (!playlistResult) throw new ApiError(500, "Error while removing video from playlists");

    const watchHistoryResult = await User.updateMany({watchHistory : new mongoose.Types.ObjectId(videoId)} , {$pull : {watchHistory : videoId}});

    if(!watchHistoryResult) throw new ApiError(500 , "error while removing video from user watch histories");

    await deleteFileByUrl(video.videoFile);
    await deleteFileByUrl(video.thumbnail);

    const deletedvideo = await Video.findByIdAndDelete(videoId);

    if(!deletedvideo)throw new ApiError(500 , "error while deleting video");

    return res.status(200).json(new ApiResponse(200 , {} , "video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const owner = req.user._id
    

    const video = await Video.findById(videoId)

    if(!video) throw new ApiError(400 , "video not found")
    if(owner.toString() != video.owner.toString())throw new ApiError(400 , "unauthorized user");

    const status = video.isPublished

    const updatedVideo = await Video.findByIdAndUpdate(videoId , {$set : {isPublished : !status}} , {new : true});

    return res.status(200).json(new ApiResponse(200 , updatedVideo.isPublished , "publish status updated successfully"));
})

const getVideoDetails = asyncHandler(async(req,res)=>{
  const { videoId } = req.params
  const owner = req.user._id
  const video = await Video.findById(videoId)

  if(video.owner.toString() !== owner.toString())throw new ApiError(400 , "not the owner");

  return res.status(200).json(new ApiResponse(200 , video , "video details fetched successfully"))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    getVideoDetails
}

