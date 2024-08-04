import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    if(!name) throw new ApiError(400 , "name is required");

    const owner = req.user._id;

    if(!owner) throw new ApiError(401 , "unauthrorized user");

    const createdPlaylist = await Playlist.create({name , description , owner})

    const isCreated = await Playlist.findById(createdPlaylist._id);

    if(!isCreated) throw new ApiError(500 , "error while creating playlist");

    return res.status(200).json(new ApiResponse(200 , createdPlaylist , "playlist created successfully"))

    
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    let {userId} = req.params
    
    const playlists = await Playlist.aggregate([
        {$match : {owner : new mongoose.Types.ObjectId(userId)}},
        {$project : {name : 1 , description : 1}}
    ])
    return res.status(200).json(new ApiResponse(200 , playlists , "playlists fetched successfully"))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const owner = req.user._id
    

    const playlist = await Playlist.findById(playlistId);

    if(!playlist) throw new ApiError(404 , "playlist not found");

    if(owner.toString() != playlist.owner.toString()) throw new ApiError(403 , "unauthorized user");

    const playlists = await Playlist.aggregate([
        {$match : {_id : new mongoose.Types.ObjectId(playlistId)}},
        {$lookup : {
            from : "videos",
            localField : "videos",
            foreignField : "_id",
            as : "videos",
            pipeline :[{
                $project : {thumbnail : 1 , duration : 1 , title : 1 , views : 1}
            }]
        }},
        
    ])

    if(!playlists || playlists.length ==0) throw new ApiError(500 , "error while searching playlist");

    return res.status(200).json(new ApiResponse(200 , playlists[0] , "playlist fetched successfully"));
    
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    const owner = req.user._id

    const playlist = await Playlist.findById(playlistId);

    if(!playlist)throw new ApiError(400 , "playlist not found")

    if(owner != playlist.owner.toString()) throw new ApiError(400 , "unauthorized user");

    let videos = playlist.videos || [];

    videos.unshift(videoId)

    const uniqueArray = videos.filter((item, pos) => videos.indexOf(item) === pos);

    playlist.videos = uniqueArray;

    await playlist.save()

    return res.status(200).json(new ApiResponse(200 , playlist , "video added successfully"))

    
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    
    const owner = req.user._id

    const playlist = await Playlist.findById(playlistId);

    if(!playlist) throw new ApiError(400 ,"Playlist not found")

    if(owner != playlist.owner.toString()) throw new ApiError(400 , "unauthorized user");

    const videos = playlist.videos || [];

    const index = videos.indexOf(videoId.toString());

    if(!index && index !=0)throw new ApiError(404 , "video not found");

    videos.splice(index , 1)

    playlist.videos = videos

    await playlist.save()

    return res.status(200).json(new ApiResponse(200 , playlist , "video removed from playlist successfully"));

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const owner = req.user._id
    
    const playlist = await Playlist.findById(playlistId);

    if(!playlist)throw new ApiError(400 , "playlist not found")

    if(owner.toString() != playlist.owner.toString()) throw new ApiError(400 , "unauthorized user")
    
    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)

    if(!deletedPlaylist) throw new ApiError(400 , "playlist not found")

    return res.status(200).json(new ApiResponse(200 , {} , "playlist delete successfully"));
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    

    const owner = req.user._id

    const playlist = await Playlist.findById(playlistId);

    if(owner.toString() != playlist.owner.toString()) throw new ApiError(400 , "unauthorized user");

    playlist.name = name;
    playlist.description = description;

    await playlist.save();

    return res.status(200).json(new ApiResponse(200 , playlist , "playlist updated successfully"));
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}