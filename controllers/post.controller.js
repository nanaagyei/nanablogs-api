import ImageKit from "imagekit";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";

export const getPosts = async (req, res) => {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;
    const skip = (page - 1) * limit;

    const query = {};

    const cat = req.query.cat;
    const author = req.query.author;
    const searchQuery = req.query.search;
    const sortQuery = req.query.sort;
    const featured = req.query.featured;

    if (cat) {
        query.category = cat;
    }
    if (author) {
        const user = await User.findOne({username: author}).select("_id");

        if (!user) {
            return res.status(404).json("No post found!")
        }
        query.user = user._id;
    }
    if (searchQuery) {
        query.title = { $regex: searchQuery, $options: "i" };
    }

    let sortObj = {createdAt: -1};
    if (sortQuery) {
        switch (sortQuery) {
            case "newest":
                sortObj = { createdAt: -1 };
                break;
            case "oldest":
                sortObj = { createdAt: 1 };
                break;
            case "popular":
                sortObj = { visit: -1 };
                break;
            case "trending":
                sortObj = { visit: -1 };
                query.createdAt = {
                    $gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
                };
                break;
            default:
                sortObj = { createdAt: -1 };
                break;
        }
    }
    if (featured) {
        query.isFeatured = true;
    }
    
    const posts = await Post.find(query)
    .populate({
        path: "user",
        select: "username"
    })
    .sort(sortObj)
    .limit(limit)
    .skip(skip);
    const totalPosts = await Post.countDocuments();
    const hasMore = page * limit < totalPosts;
    res.status(200).json({posts, hasMore})
};

export const getPost = async (req, res) => {
    const post = await Post.findOne({slug: req.params.slug}).populate({
        path: "user",
        select: "username img"
    })
    res.status(200).json(post)
};

export const createPost = async (req, res) => {

    const clerkUserId = req.auth.userId;

    if (!clerkUserId) {
        return res.status(401).json("User not authenticated!");
    }

    const user = await User.findOne({ clerkUserId })

    if (!user) {
        return res.status(404).json("User not found!")
    }

    let slug = req.body.title.replace(/ /g, "-").toLowerCase();

    let existingPost = await Post.findOne({ slug });

    let counter = 2;

    while (existingPost) {
        slug = `${slug}-${counter}`;
        existingPost = await Post.findOne({ slug });
        counter++;
    }

    const newPost = new Post({user: user._id, ...req.body, slug})
    const savedPost = await newPost.save()
    res.status(200).json(savedPost)
};

export const deletePost = async (req, res) => {

    const clerkUserId = req.auth.userId;

    if (!clerkUserId) {
        return res.status(401).json("User not authenticated!");
    }

    const role = req.auth.sessionClaims?.metadata?.role || "user";

    if (role === "admin") {
        await Post.findByIdAndDelete(req.params.id);
        return res.status(200).json("Post deleted successfully");
    }

    const user = await User.findOne({ clerkUserId })

    if (!user) {
        return res.status(404).json("User not found!")
    }

    const deletedPost = await Post.findByIdAndDelete({
        _id: req.params.id,
        user: user._id
    })

    if (!deletedPost) {
        return res.status(403).json("Post cannot be deleted. You are only allowed to delete your posts!")
    }
    res.status(200).json("Post deleted successfully")
};

export const featurePost = async (req, res) => {

    const clerkUserId = req.auth.userId;
    const postId = req.body.postId;

    if (!clerkUserId) {
        return res.status(401).json("User not authenticated!");
    }

    const role = req.auth.sessionClaims?.metadata?.role || "user";

    if (role !== "admin") {
        return res.status(403).json("You are not allowed to feature this post!");
    }

    const post = await Post.findById(postId);

    if (!post) {
        return res.status(404).json("Post not found!")
    }

    const isFeatured = post.isFeatured;

    const updatedPost = await Post.findByIdAndUpdate(postId, {
        isFeatured: !isFeatured,
    }, {
        new: true
    })

    if (!updatedPost) {
        return res.status(404).json("Post not found!")
    }
    res.status(200).json(updatedPost)
};

const imagekit = new ImageKit({
    urlEndpoint: process.env.IK_URL_ENDPOINT,
    publicKey: process.env.IK_PUBLIC_KEY,
    privateKey: process.env.IK_PRIVATE_KEY,
});

export const uploadAuth = async (req, res) => {
    const result = imagekit.getAuthenticationParameters();
    res.send(result);
}