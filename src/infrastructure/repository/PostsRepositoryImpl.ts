import { Collection, ObjectId, WithId } from "mongodb";
import { PostsResultDto } from "../../core/dto/Posts/PostsResult.dto";
import { ErrorResponse } from "../../core/entity/ErrorRespose.entity";
import { PostsData } from "../../core/entity/PostsData.entity";
import { PostsRepository } from "../../core/repository/PostsRepository";
import { getDatabase } from "../../middleware/MongoDB";
import { Either, makeLeft, makeRight } from "../../utils/Either";
import { CommentDto } from "../../core/dto/Posts/Comment.dto";
import { ReactionDto } from "../../core/dto/Posts/Reaction.dto";
import { ReactionsDto } from "../../core/dto/Posts/Reactions.dto";
import { CommentsDto } from "../../core/dto/Posts/Comments.dto";
import { PostsDto } from "../../core/dto/Posts/Posts.dto";

export class PostsRepositoryImpl implements PostsRepository {
  private db = getDatabase();
  private postsCollection = this.db.collection("Posts");
  private commentsCollection = this.db.collection("Comments");
  private userCollection = this.db.collection("Users");

  async createPost(
    postData: PostsData
  ): Promise<Either<ErrorResponse, string>> {
    const reactionCollection = this.db.collection("Reactions");
    try {
      const likesResult = await reactionCollection.insertOne({
        reactionsList: [],
      });

      const commentsResult = await this.commentsCollection.insertOne({
        commentsList: [],
      });

      const post: PostsData = {
        postedBy: new ObjectId(postData.postedBy),
        postedByName: postData.postedByName,
        title: postData.title,
        body: postData.body,
        reactionsCount: postData.reactionsCount,
        commentsCount: postData.commentsCount,
        createdAt: new Date(),
        reactions: likesResult.insertedId,
        comments: commentsResult.insertedId,
      };

      await this.postsCollection.insertOne(post);

      return makeRight("created");
    } catch (e) {
      const errorResponse: ErrorResponse = {
        statusCode: 400,
        errorMessage: e?.toString() ?? "",
      };
      return makeLeft(errorResponse);
    }
  }

  async deletePost(
    postId: ObjectId,
    deleteByUser: ObjectId
  ): Promise<Either<ErrorResponse, string>> {
    const reactionCollection = this.db.collection("Reactions");
    const collection: Collection<PostsData> = this.db.collection("Posts");
    try {
      const postData = await collection.findOneAndDelete({
        _id: new ObjectId(postId),
      });

      const validUserToDelete = deleteByUser == postData?.postedBy;

      if (!validUserToDelete) {
        const errorResponse: ErrorResponse = {
          statusCode: 401,
          errorMessage: "Not Authorized",
        };
        return makeLeft(errorResponse);
      }

      await reactionCollection.findOneAndDelete({
        _id: new ObjectId(postData.reactions),
      });

      await this.commentsCollection.findOneAndDelete({
        _id: new ObjectId(postData.comments),
      });

      return makeRight("deleted");
    } catch (e) {
      const errorResponse: ErrorResponse = {
        statusCode: 400,
        errorMessage: e?.toString() ?? "",
      };
      return makeLeft(errorResponse);
    }
  }

  async getMyPosts(
    postedBy: ObjectId,
    page: number,
    pageSize: number = 10 // Default page size
  ): Promise<Either<ErrorResponse, PostsResultDto>> {
    let postsResult!: PostsResultDto;
    let errorResponse!: ErrorResponse;

    try {
      // Calculate the total number of documents matching the criteria
      const post = await this.postsCollection
        .find({
          postedBy: new ObjectId(postedBy),
        })
        .toArray();

      if (!post) {
        errorResponse = {
          statusCode: 404,
          errorMessage: "Post Record Not Found!",
        };
        return makeLeft(errorResponse);
      }

      // Calculate the total number of items and the maximum number of pages
      const totalItems = post.length;
      const maxPage = Math.ceil(totalItems / pageSize);

      // If the requested page number exceeds the maximum pages, return an error response
      if (page > maxPage) {
        errorResponse = {
          statusCode: 404,
          errorMessage: "Page number exceeds maximum pages",
        };
        return makeLeft(errorResponse);
      }

      // Calculate the number of documents to skip for the current page
      const skip = (page - 1) * pageSize;

      // Slice the postsList to get only the items for the current page
      const pagedPostList = post
        .slice(skip, skip + pageSize)
        .map(
          (postData: any) =>
            new PostsData(
              postData.postedBy,
              postData.postedByName,
              postData.title,
              postData.body,
              postData.reactionsCount,
              postData.commentsCount,
              new Date(postData.createdAt),
              postData.likes,
              postData.comments,
              postData._id
            )
        );

      // Create the result object with the current page, maxPage, and paged posts list
      postsResult = {
        currentPage: page,
        maxPage: maxPage,
        postsList: pagedPostList,
      };

      // Return the result object
      return makeRight(postsResult);
    } catch (e) {
      // In case of any error, create and return an error response with status code 500
      errorResponse = {
        statusCode: 500,
        errorMessage: `An error occurred while retrieving posts: ${e}`,
      };
      return makeLeft(errorResponse);
    }
  }

  async getAllPosts(
    page: number,
    pageSize: number = 10
  ): Promise<Either<ErrorResponse, PostsResultDto>> {
    let postsResult!: PostsResultDto;
    let errorResponse!: ErrorResponse;

    try {
      // Fetch all posts from the collection
      const posts = await this.postsCollection.find({}).toArray();

      if (!posts || posts.length === 0) {
        errorResponse = {
          statusCode: 404,
          errorMessage: "No posts found!",
        };
        return makeLeft(errorResponse);
      }

      // Apply a simple ranking algorithm:
      const rankedPosts = posts.sort((a: any, b: any) => {
        // Rank by reaction, then by the number of comments, and finally by recency
        const likeDifference = b.likes - a.likes;
        const commentDifference = b.comments.length - a.comments.length;
        const dateDifference =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

        if (likeDifference !== 0) return likeDifference;
        if (commentDifference !== 0) return commentDifference;
        return dateDifference;
      });

      // , shuffle posts to introduce some randomness
      const shuffledPosts = rankedPosts.sort(() => 0.5 - Math.random());

      // Calculate pagination details
      const totalItems = shuffledPosts.length;
      const maxPage = Math.ceil(totalItems / pageSize);

      if (page > maxPage) {
        errorResponse = {
          statusCode: 404,
          errorMessage: "Page number exceeds maximum pages",
        };
        return makeLeft(errorResponse);
      }

      // Slice the posts list to get the items for the current page
      const pagedPostList = shuffledPosts
        .slice((page - 1) * pageSize, page * pageSize)
        .map(
          (postData: any) =>
            new PostsData(
              postData.postedBy,
              postData.postedByName,
              postData.title,
              postData.body,
              postData.reactionsCount,
              postData.commentsCount,
              new Date(postData.createdAt),
              postData.reactions,
              postData.comments,
              postData._id
            )
        );

      // Create the result object
      postsResult = {
        currentPage: page,
        maxPage: maxPage,
        postsList: pagedPostList,
      };

      // Return the result object
      return makeRight(postsResult);
    } catch (e) {
      errorResponse = {
        statusCode: 500,
        errorMessage: `An error occurred while retrieving posts: ${e}`,
      };
      return makeLeft(errorResponse);
    }
  }

  async editPost(
    postId: ObjectId,
    editByUser: ObjectId,
    postData: PostsDto
  ): Promise<Either<ErrorResponse, string>> {
    const postcollection: Collection<PostsData> = this.db.collection("Posts");
    let errorResponse: ErrorResponse;
    try {
      const isValidUser = await this.userCollection.findOne({
        _id: new ObjectId(editByUser),
      });
      if (!isValidUser) {
        errorResponse = {
          statusCode: 403,
          errorMessage: "Not a valid user",
        };
        return makeLeft(errorResponse);
      }
      const post = await postcollection.findOne({ _id: new ObjectId(postId) });

      const isAuthorizedToEdit = new ObjectId(post?.postedBy).equals(
        new ObjectId(editByUser)
      );

      if (!isAuthorizedToEdit) {
        errorResponse = {
          statusCode: 401,
          errorMessage: "Not Authorized",
        };
        return makeLeft(errorResponse);
      }

      const updateQuery = {
        $set: {
          [`title`]: postData.title,
          [`body`]: postData.body,
        },
      };

      await postcollection.updateOne(
        { _id: new ObjectId(postId) },
        updateQuery
      );

      return makeRight("Post updated successfully");
    } catch (e) {
      errorResponse = {
        statusCode: 500,
        errorMessage: e?.toString() ?? "An error occurred",
      };
      return makeLeft(errorResponse);
    }
  }

  async addComment(
    commentToPost: ObjectId,
    commentData: CommentDto
  ): Promise<Either<ErrorResponse, string>> {
    const collection: Collection<CommentDto> = this.db.collection("Comments");
    const postcollection: Collection<PostsData> = this.db.collection("Posts");
    let errorResponse: ErrorResponse;
    try {
      const isValidUser = await this.userCollection.findOne({
        _id: new ObjectId(commentData.commentBy),
      });
      if (!isValidUser) {
        errorResponse = {
          statusCode: 403,
          errorMessage: "Not a valid user",
        };
        return makeLeft(errorResponse);
      }
      const post = await postcollection.findOne({
        _id: new ObjectId(commentToPost),
      });

      const commentListId = post?.comments;

      await collection.updateOne(
        { _id: new ObjectId(commentListId) },
        { $push: { commentsList: commentData } }
      );

      // adding a comment count
      await postcollection.updateOne(
        {
          _id: new ObjectId(commentToPost),
        },
        { $set: { commentsCount: (post?.commentsCount ?? 0) + 1 } }
      );

      return makeRight("Comment Posted");
    } catch (e) {
      errorResponse = {
        statusCode: 500,
        errorMessage: `Failed to make a comment : ${e}`,
      };
      return makeLeft(errorResponse);
    }
  }

  async deleteComment(
    commentId: ObjectId,
    commentIdOnList: ObjectId,
    deleteByUser: ObjectId
  ): Promise<Either<ErrorResponse, string>> {
    const commentsCollection: Collection<CommentsDto> =
      this.db.collection("Comments");
    const postCollection: Collection<PostsData> = this.db.collection("Posts");
    try {
      const commentData = await commentsCollection.findOne({
        _id: new ObjectId(commentId),
      });

      if (!commentData) {
        const errorResponse: ErrorResponse = {
          statusCode: 404,
          errorMessage: "Comment not found",
        };
        return makeLeft(errorResponse);
      }

      // Find the index of the specific comment within the list
      const existingCommentIndex = commentData.commentsList.findIndex(
        (comment) => comment._id.equals(new ObjectId(commentIdOnList))
      );

      if (existingCommentIndex === -1) {
        const errorResponse: ErrorResponse = {
          statusCode: 404,
          errorMessage: "Comment not found in list",
        };
        return makeLeft(errorResponse);
      }

      const comment = commentData.commentsList[existingCommentIndex];

      const validUserToDelete = new ObjectId(deleteByUser).equals(
        new ObjectId(comment.commentBy)
      );

      if (!validUserToDelete) {
        const errorResponse: ErrorResponse = {
          statusCode: 401,
          errorMessage: "Not Authorized",
        };
        return makeLeft(errorResponse);
      }

      // Remove the comment
      commentData.commentsList.splice(existingCommentIndex, 1);

      await commentsCollection.updateOne(
        { _id: new ObjectId(commentId) },
        { $set: { commentsList: commentData.commentsList } }
      );

      // Update the post to decrement the comments count
      await postCollection.updateOne(
        { comments: new ObjectId(commentId) },
        { $inc: { commentsCount: -1 } } // Decrement the comments count
      );

      return makeRight("Comment deleted");
    } catch (e) {
      const errorResponse: ErrorResponse = {
        statusCode: 500,
        errorMessage: e?.toString() ?? "An error occurred",
      };
      return makeLeft(errorResponse);
    }
  }

  async editComment(
    commentId: ObjectId,
    editByUser: ObjectId,
    updatedCommentData: CommentDto
  ): Promise<Either<ErrorResponse, string>> {
    const collection: Collection<CommentsDto> = this.db.collection("Comments");
    let errorResponse: ErrorResponse;
    try {
      // Find the document containing the comment list
      const commentData = await collection.findOne({
        _id: new ObjectId(commentId),
        // "commentsList._id": updatedCommentData._id,
      });

      if (!commentData) {
        errorResponse = {
          statusCode: 404,
          errorMessage: "Comment not found",
        };
        return makeLeft(errorResponse);
      }

      // Find the index of the specific comment within the list
      const existingCommentIndex = commentData.commentsList.findIndex(
        (comment) => comment._id.equals(new ObjectId(updatedCommentData._id))
      );

      if (existingCommentIndex === -1) {
        errorResponse = {
          statusCode: 404,
          errorMessage: "Comment not found in list",
        };
        return makeLeft(errorResponse);
      }

      const comment = commentData.commentsList[existingCommentIndex];

      const validUserToEdit = new ObjectId(editByUser).equals(
        new ObjectId(comment.commentBy)
      );

      if (!validUserToEdit) {
        errorResponse = {
          statusCode: 401,
          errorMessage: "Not Authorized",
        };
        return makeLeft(errorResponse);
      }

      // Update the specific comment within the list
      const updateQuery = {
        $set: {
          [`commentsList.${existingCommentIndex}.commentBy`]:
            updatedCommentData.commentBy,
          [`commentsList.${existingCommentIndex}.name`]:
            updatedCommentData.name,
          [`commentsList.${existingCommentIndex}.comment`]:
            updatedCommentData.comment,
        },
      };

      await collection.updateOne({ _id: new ObjectId(commentId) }, updateQuery);

      return makeRight("Comment updated successfully");
    } catch (e) {
      errorResponse = {
        statusCode: 500,
        errorMessage: e?.toString() ?? "An error occurred",
      };
      return makeLeft(errorResponse);
    }
  }

  async addReaction(
    reactToPost: ObjectId,
    reactionData: ReactionDto
  ): Promise<Either<ErrorResponse, string>> {
    const reactionCollection: Collection<ReactionsDto> =
      this.db.collection("Reactions");
    const postCollection: Collection<PostsData> = this.db.collection("Posts");
    let errorResponse: ErrorResponse;

    try {
      // Check if the user is valid
      const isValidUser = await this.userCollection.findOne({
        _id: new ObjectId(reactionData.reactedBy),
      });
      if (!isValidUser) {
        errorResponse = {
          statusCode: 403,
          errorMessage: "Not a valid user",
        };
        return makeLeft(errorResponse);
      }

      // Find the post
      const post = await postCollection.findOne({
        _id: new ObjectId(reactToPost),
      });
      if (!post) {
        errorResponse = {
          statusCode: 404,
          errorMessage: "Post not found",
        };
        return makeLeft(errorResponse);
      }

      // Find the reactions document associated with the post
      const reactionDoc = await reactionCollection.findOne({
        _id: new ObjectId(post.reactions),
      });

      if (!reactionDoc) {
        // No reaction document exists, create a new one with the new reaction
        await reactionCollection.updateOne(
          { _id: new ObjectId(post.reactions) },
          { $push: { reactionsList: reactionData } },
          { upsert: true } // Ensure document is created if it doesn't exist
        );
      } else {
        // Check if the user has already reacted
        const existingReactionIndex = reactionDoc.reactionsList.findIndex(
          (reaction) => reaction.reactedBy.equals(reactionData.reactedBy)
        );

        if (existingReactionIndex > -1) {
          // Get the existing reaction type
          const existingReactionType =
            reactionDoc.reactionsList[existingReactionIndex].reactionType;

          if (existingReactionType === reactionData.reactionType) {
            // If reaction types match, remove the reaction
            reactionDoc.reactionsList.splice(existingReactionIndex, 1);

            // Update the post to decrement the reaction count
            await postCollection.updateOne(
              { _id: new ObjectId(reactToPost) },
              { $inc: { reactionsCount: -1 } } // Decrement the reaction count
            );
          } else {
            // Otherwise, update the reaction type and date
            reactionDoc.reactionsList[existingReactionIndex].reactionType =
              reactionData.reactionType;
            reactionDoc.reactionsList[existingReactionIndex].reactOn =
              new Date();
          }
        } else {
          // Add a new reaction if the user hasn't reacted yet
          reactionDoc.reactionsList.push(reactionData);

          // Adding a reaction count
          await postCollection.updateOne(
            {
              _id: new ObjectId(reactToPost),
            },
            { $set: { reactionsCount: (post?.reactionsCount ?? 0) + 1 } }
          );
        }

        // Update the reactions document
        await reactionCollection.updateOne(
          { _id: new ObjectId(post.reactions) },
          { $set: { reactionsList: reactionDoc.reactionsList } }
        );
      }

      return makeRight("Reacted");
    } catch (e) {
      errorResponse = {
        statusCode: 500,
        errorMessage: `Failed to add a reaction: ${e}`,
      };
      return makeLeft(errorResponse);
    }
  }
}
