/// [other imports]
import express, { Router } from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { connectToDatabase } from "./middleware/MongoDB";

/// [controller imports]
import { UserController } from "./interface/controller/UserController";
import { LoginController } from "./interface/controller/LoginController";
import { PostController } from "./interface/controller/PostController";

/// [usecases imports]
import { CreateUserUsecase } from "./usecase/CreateUser.usecase";
import { LoginUserUsecase } from "./usecase/LoginUser.usecase";

/// [repository implementation imports]
import { UserRepositoryImpl } from "./infrastructure/repository/UserRepositoryImpl";
import { AuthenticationRepositoryImpl } from "./infrastructure/repository/AuthenticationRepositoryImpl";
import { GetUsersUsecase } from "./usecase/GetUsers.usecase";
import { authenticateToken } from "./middleware/AuthenticateToken";
import { PostsRepositoryImpl } from "./infrastructure/repository/PostsRepositoryImpl";
import { CreatePostUsecase } from "./usecase/CreatePosts.usecase";
import { GetMyPostsUsecase } from "./usecase/GetMyPosts.usecase";
import { ChatRepositoryImpl } from "./infrastructure/repository/ChatRepositoryImpl";
import { ChatSseUsecase } from "./usecase/ChatSse.usecase";
import { GetConversationUsecase } from "./usecase/GetConversation.usecase";
import { ChatController } from "./interface/controller/ChatController";
import { GetConversationsUsecase } from "./usecase/GetConversations.usecase";
import { DeletePostUsecase } from "./usecase/DeletePosts.usecase";
import { AddCommentUsecase } from "./usecase/AddComment.usecase";
import { AddReactionUsecase } from "./usecase/AddReaction.usecase";
import { GetAllPostsUsecase } from "./usecase/GetAllPosts.usecase";
import { GetUserUsecase } from "./usecase/GetUser.usecase";
import { DeleteCommentUsecase } from "./usecase/DeleteComment.usecase";
import { EditCommentUsecase } from "./usecase/EditComment.usecase";
import { EditPostUsecase } from "./usecase/EditPost.usecase";
/// initaialize env's
dotenv.config();

const app = express();
const port = process.env.PORT;

// Connect to MongoDB
connectToDatabase().catch(console.error);

/// Implementations
///
const userRepository = new UserRepositoryImpl();
const authenticationRepository = new AuthenticationRepositoryImpl();
const postRepository = new PostsRepositoryImpl();
const chatRepository = new ChatRepositoryImpl();

/// Usecases
///
const loginUserUsecase = new LoginUserUsecase(authenticationRepository);
const getAllUsersUsecase = new GetUsersUsecase(userRepository);
const createUserUsecase = new CreateUserUsecase(userRepository);
const getUserUsecase = new GetUserUsecase(userRepository);
const createPostUsecase = new CreatePostUsecase(postRepository);
const deletePostUsecase = new DeletePostUsecase(postRepository);
const editPostUsecase = new EditPostUsecase(postRepository);
const getMyPostsUsecase = new GetMyPostsUsecase(postRepository);
const getAllPostsUsecase = new GetAllPostsUsecase(postRepository);
const addCommentUsecase = new AddCommentUsecase(postRepository);
const deleteByUserUsecase = new DeleteCommentUsecase(postRepository);
const editCommentUsecase = new EditCommentUsecase(postRepository);
const addReactionUsecase = new AddReactionUsecase(postRepository);
const chatSseUsecase = new ChatSseUsecase(chatRepository);
const getConversationUsecase = new GetConversationUsecase(chatRepository);
const getConversationsUsecase = new GetConversationsUsecase(chatRepository);

/// Controllers
///
const userController = new UserController(
  createUserUsecase,
  getAllUsersUsecase,
  getUserUsecase
);
const loginController = new LoginController(loginUserUsecase);
const postController = new PostController(
  createPostUsecase,
  getMyPostsUsecase,
  deletePostUsecase,
  editPostUsecase,
  addCommentUsecase,
  deleteByUserUsecase,
  editCommentUsecase,
  addReactionUsecase,
  getAllPostsUsecase
);
const chatController = new ChatController(
  chatSseUsecase,
  getConversationUsecase,
  getConversationsUsecase
);

// Middleware
app.use(bodyParser.json());

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to Connectly");
});

// Auth Route
app.post("/login", (req, res) => loginController.login(req, res));

// Users Route
app.post("/registerUser", (req, res) => userController.registerUser(req, res));
app.get("/getUsers", authenticateToken, (req, res) =>
  userController.getUsers(req, res)
);
app.get("/getUser/:user", authenticateToken, (req, res) =>
  userController.getUser(req, res)
);

// Posts Route
app.post("/createpost", authenticateToken, (req, res) =>
  postController.createPost(req, res)
);
app.get("/posts/:page", authenticateToken, (req, res) =>
  postController.getAllPosts(req, res)
);
app.get("/myposts/:postedBy/:page", authenticateToken, (req, res) =>
  postController.myPosts(req, res)
);
app.delete("/deletePost/:postId/:user", authenticateToken, (req, res) =>
  postController.deletePost(req, res)
);
app.patch("/editPost/:postId/:editByUser", authenticateToken, (req, res) =>
  postController.editPost(req, res)
);
app.post("/addComment", authenticateToken, (req, res) =>
  postController.addComment(req, res)
);
app.delete(
  "/deleteComment/:commentId/:commentIdOnList/:deleteByUser",
  authenticateToken,
  (req, res) => postController.deleteComment(req, res)
);
app.patch(
  "/editComment/:commentId/:editByUser",
  authenticateToken,
  (req, res) => postController.editComment(req, res)
);
app.post("/addReaction", authenticateToken, (req, res) =>
  postController.addReaction(req, res)
);

// Chat Sse Route
const chatRouter = Router();
app.use("/chat", chatRouter);

chatRouter.get("/events", authenticateToken, (req, res) =>
  chatController.sse(req, res)
);

chatRouter.post("/send", authenticateToken, (req, res) =>
  chatController.sendMessage(req, res)
);

app.get("/getConversation", authenticateToken, (req, res) =>
  chatController.getConversation(req, res)
);

app.get("/getConversations", authenticateToken, (req, res) =>
  chatController.getConversations(req, res)
);
// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
