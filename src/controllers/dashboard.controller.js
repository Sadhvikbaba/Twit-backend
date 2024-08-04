import mongoose from "mongoose"
import {Video} from "../models/video.models.js"
import {Subscription} from "../models/subscription.models.js"
import {Like} from "../models/like.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const {channel} =req.params
    
    const totalViews = await Video.aggregate([
        {$match : {owner : new mongoose.Types.ObjectId(channel)}},
        {$group : {_id : null , totalViews : {$sum : "$views"}}}
    ])

    const totalLikes = await Like.aggregate([
        {$lookup :{
            from : "videos",
            localField : "video",
            foreignField : "_id",
            as : "videoInfo"
        }},
        {$unwind : "$videoInfo"},
        {$match : {"videoInfo.owner" : new mongoose.Types.ObjectId(channel)}},
        {$group : {_id : null , totalLikes : {$sum :1}}}
    ]);

    return res.status(200).json(new ApiResponse(200 , {
        totalViews : totalViews[0] ? totalViews[0].totalViews : 0,
        totalLikes : totalLikes[0] ? totalLikes[0].totalLikes : 0
    } , "total views and likes fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const {channel} =req.params
    
    const videos = await Video.aggregate([
        {$match : {owner : new mongoose.Types.ObjectId(channel)}},
        {$project : {
            thumbnail : 1,
            title : 1,
            duration : 1,
            views : 1,
            createdAt : 1
        }}
    ])

    res.status(200).json(new ApiResponse(200 , videos , "channel videos fetched successfully"))
})

export {
    getChannelStats, 
    getChannelVideos
    }