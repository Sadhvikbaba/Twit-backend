import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const healthcheck = asyncHandler(async (req, res) => {
    
    return res.status(200).json({status : "ok" , message : "server is running properly" })
})

export {
    healthcheck
    }
    