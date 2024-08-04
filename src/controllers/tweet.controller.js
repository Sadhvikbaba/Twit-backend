import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.models.js"
import { Like } from "../models/like.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    
    const {content} = req.body;
    const owner = req.user._id;
    if(!owner) throw new ApiError(400 , "unauthorized user")

    if(!content) throw new ApiError(400 , "content is required");

    const createdTweet = await Tweet.create({owner , content});

    if(!createTweet) throw new ApiError(500 , "error while creating tweet");

    return res.status(200).json(new ApiResponse(200 , createdTweet , "tweet created successfully"));
})

const getUserTweets = asyncHandler(async (req, res) => {
    
    const {userId} = req.params
    const owner = req.user._id

    const totalLikes = async (tweetId) => {
        const likes = await Like.aggregate([
            { $match: { tweet: new mongoose.Types.ObjectId(tweetId) } },
            { $group: { _id: null, totalLikes: { $sum: 1 } } }
        ]);
        return likes[0]?.totalLikes || 0;  
    };

    const isLiked = async(likedBy , tweet) => {
        const response = await Like.findOne({likedBy , tweet})

        return response ? true : false;
    }

    if(!isValidObjectId(userId)) throw new ApiError(400 , "invalid user id");

    const tweets = await Tweet.aggregate([
        {$match : {owner : new mongoose.Types.ObjectId(userId)}},
    ]);

    const processedTweets = await Promise.all(tweets.map(async (tweet) => {
        const liked = await isLiked(owner, tweet._id);
        const likes = await totalLikes(tweet._id);
        return {
            ...tweet,
            isLiked: liked,
            totalLikes : likes
        };
    }));

    return res.status(200).json(new ApiResponse(200 , processedTweets , "user tweets fetched Successfully"));
})

const getTweets = asyncHandler(async (req , res) =>{
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const totalLikes = async (tweetId) => {
        const likes = await Like.aggregate([
            { $match: { tweet: new mongoose.Types.ObjectId(tweetId) } },
            { $group: { _id: null, totalLikes: { $sum: 1 } } }
        ]);
        return likes[0]?.totalLikes || 0;  
    };

    const isLiked = async(likedBy , tweet) => {
        const response = await Like.findOne({likedBy , tweet})

        return response ? true : false;
    }

    const tweets = await Tweet.aggregate([
        { $skip: (pageNumber - 1) * limitNumber },
        { $limit: limitNumber },
        {$lookup : {
            from  : "users",
            localField : "owner",
            foreignField : "_id",
            as : "owner",
            pipeline : [{
                $project : {
                    avatar : 1,
                    userName : 1
                }
            }]
        }},{
            $project : {
                owner : 1,
                content : 1   
            }
        }
    ])

    if(!tweets) throw new ApiError(500 , "error while fetching tweets");

    const processedTweets = await Promise.all(tweets.map(async (tweet) => {
        const liked = await isLiked(userId, tweet._id);
        const likes = await totalLikes(tweet._id);
        return {
            ...tweet,
            isLiked: liked,
            totalLikes : likes
        };
    }));

    res.status(200).json(new ApiResponse(200 , processedTweets , "tweets fetched successfully"));
})

const updateTweet = asyncHandler(async (req, res) => {
    
    const {tweetId} = req.params
    const {content} = req.body

    const tweet = await Tweet.findById(tweetId);

    if(tweet.owner.toString()  != req.user._id.toString())throw new ApiError(400 , "unauthorized user");

    const updatedTweet = await Tweet.findByIdAndUpdate(tweetId , {$set : {content : content}} , {new : true})

    if(!updatedTweet)throw new ApiError(500 , "error while updating tweet");

    res.status(200).json(new ApiResponse(200 , updatedTweet , "tweet updated successfully"));
})

const deleteTweet = asyncHandler(async (req, res) => {
    
    const {tweetId} = req.params

    if(!isValidObjectId(tweetId))throw new ApiError(400 , "its not a vaild tweet id")

    const tweet = await Tweet.findById(tweetId);

    if(!tweet) throw new ApiError(400 , "tweet not found")

    if(tweet.owner.toString()  != req.user._id.toString())throw new ApiError(400 , "unauthorized user");

    const likeResult = await Like.updateMany({tweet : new mongoose.Types.ObjectId(tweetId)} , {$set : {tweet : null}});

    if(!likeResult) throw new ApiError(500 , "error while deleting likes for the tweet")

    const responce = await Tweet.findByIdAndDelete(tweetId);

    if(!responce) throw new ApiError(500 , "error while deleting the tweet");

    return res.status(200).json(new ApiResponse(200 , {} , "tweet deleted successfully"));
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
    getTweets
}