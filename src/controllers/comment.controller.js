import mongoose from "mongoose"
import {Comment} from "../models/comment.models.js"
import {Like} from "../models/like.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const isLiked = async (userId, commentId) => {
        const response = await Like.findOne({ likedBy: userId, comment: commentId });
        return response ? true : false;
    }

    const totalLikes = async (commentId) => {
        const likes = await Like.aggregate([
            { $match: { comment: new mongoose.Types.ObjectId(commentId) } },
            { $group: { _id: null, totalLikes: { $sum: 1 } } }
        ]);
        return likes[0]?.totalLikes || 0;  
    };

    const comments = await Comment.aggregate([
        { $match: { videoId: new mongoose.Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: 'users',
                localField: 'owner',
                foreignField: '_id',
                as: 'owner',
                pipeline: [
                    {
                        $project: {
                            userName: 1,
                        },
                    },
                ],
            }
        },
        { $unwind: '$owner' }, // Unwind to convert the owner array into individual documents
        { $skip: (pageNumber - 1) * limitNumber },
        { $limit: limitNumber },
        {
            $project: {
                owner: 1,
                content: 1,
                createdAt: 1,
                isLiked: { $literal: false } // Placeholder for `isLiked` to maintain schema
            }
        }
    ]);

    
    const userId = req.user._id; 
    const processedComments = await Promise.all(comments.map(async (comment) => {
        const liked = await isLiked(userId, comment._id);
        const totallikes = await totalLikes(comment._id);
        return {
            ...comment,
            isLiked: liked,
            totalLikes : totallikes,
        };
    }));

    res.status(200).json(new ApiResponse(200, processedComments, 'Comments retrieved successfully'));
});

const addComment = asyncHandler(async (req, res) => {
    
    const {videoId}= req.params;
    const {content} = req.body;
    const owner = req.user._id;

    if(!content) throw new ApiError(400 , "content is required");
    if(!owner) throw new ApiError(400 , "unauthorized user");

    const responce = await Comment.create({owner , content , videoId});

    if(!responce) throw new ApiError(500 , "error while uploading video");

    return res.status(200).json( new ApiResponse(200 , responce , "comment added successfully"));
})

const updateComment = asyncHandler(async (req, res) => {
    
    const { commentId } = req.params
    const {content} = req.body
    
    let comment = await Comment.findById(commentId);

    if(!comment)throw new ApiError(400 , "comment not found");

    if(comment.owner.toString() != req.user._id.toString()) throw new ApiError(400 , "unauthorized user");

    const responce = await Comment.findByIdAndUpdate(commentId ,{$set : {content : content}} , {new : true} );

    return res.status(200).json(new ApiResponse(200 , responce , "comment updated successfully"))
    
})

const deleteComment = asyncHandler(async (req, res) => {
    
    const {commentId} = req.params

    const comment = await Comment.findById(commentId);

    if(comment.owner.toString()  != req.user._id.toString()) throw new ApiError(400 , "unauthorized user");

    const likeResult = await Like.updateMany({comment : new mongoose.Types.ObjectId(commentId)} , {$set : {comment : null}});

    if(!likeResult) throw new ApiError(500 , "error while deleting likes for the comment")
    
    const deletedComment = await Comment.findByIdAndDelete(commentId);

    if(!deletedComment)throw new ApiError(500 , "error while deleting comment");

    return res.status(200).json(new ApiResponse(200 , {} , "comment deleted successfully"));
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }