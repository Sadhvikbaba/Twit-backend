import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.models.js"
import { Subscription } from "../models/subscription.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    const subscriber = req.user._id
    
    const subscription = await Subscription.findOne({channel : channelId , subscriber})
    if(subscription){
        await Subscription.findByIdAndDelete(subscription._id);
        res.status(200).json(new ApiResponse(200 , {} , "removed subscription successfully"))
    }else{
        const subscribe = await Subscription.create({subscriber , channel : channelId});

        if(!subscribe) throw new ApiError(500 , "error while subscription");

        res.status(200).json(new ApiResponse(200 , subscribe , "channel subscribed successfully"))
    }
})


const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {subscriberId} = req.params;
    const id = req.user._id

    const isSubscribed = async (userId, owner) => {
        const response = await Subscription.findOne({ subscriber : userId , channel: owner });
        return response ? true : false;
    }

    const subscribers = await Subscription.aggregate([
        {$match : {channel : new mongoose.Types.ObjectId(subscriberId)}},
        {$lookup : {
            from : "users",
            localField : "subscriber",
            foreignField : "_id",
            as : "subscribers",
            pipeline : [{
                $project : {
                    userName : 1,
                    avatar : 1
                }
            }]
        }},{
            $unwind: "$subscribers" 
        },{
            $project: {
                _id: "$subscribers._id",
                userName: "$subscribers.userName",
                avatar: "$subscribers.avatar"
            }
        }
    ])
    if(!subscribers)throw new ApiError(500 , "error while fetching subscribers");

    if(subscribers.length==0) return res.status(200).json(new ApiResponse(200 , false,"subscribers fetched successfully"))

    const processedsubscribers = await Promise.all(subscribers.map(async(subscriber) => {
        const subscribed = await isSubscribed(id,subscriber._id)
        return {
            ...subscriber,
            isSubscribed : subscribed
        }
    }))

    return res.status(200).json(new ApiResponse(200 , processedsubscribers , "subscribers fetched successfully"))
})


const getSubscribedChannels = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    const subscribedChannels = await Subscription.aggregate([
        {$match: {subscriber: new mongoose.Types.ObjectId(channelId)}},
        {$lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedChannels",
                pipeline: [{$project: {
                            userName: 1,
                            avatar: 1
                        }
                    }]
            }
        },{
            $unwind: "$subscribedChannels" 
        },{
            $project: {
                _id: "$subscribedChannels._id",
                userName: "$subscribedChannels.userName",
                avatar: "$subscribedChannels.avatar"
            }
        }
    ]);
    if(!subscribedChannels)throw new ApiError(500 , "error while fetching subscribed channels");

    return res.status(200).json(new ApiResponse(200 , subscribedChannels , "subscribed channels fetched successfully"));
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}