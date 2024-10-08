import mongoose , {Schema , model} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const playlistSchema = new Schema({
    videos : [{
        type : Schema.Types.ObjectId,
        ref : "Video"
    }],
    name : {
        type : String,
        required : true
    },
    description : {
        type : String,
        default : ""
    },
    owner : {
        type : Schema.Types.ObjectId,
        ref : "User"
    }
} , {timestamps : true})

export const Playlist = model("Playlist" , playlistSchema)