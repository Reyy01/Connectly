import { ObjectId } from "mongodb";
import { ErrorResponse } from "../core/entity/ErrorRespose.entity";
import { PostsRepository } from "../core/repository/PostsRepository";
import { Either } from "../utils/Either";
import { PostsData } from "../core/entity/PostsData.entity";

export class CreatePostUsecase {
  constructor(private postsRepository: PostsRepository) {}

  async execute({
    postedBy,
    postedByName,
    title,
    body,
  }: {
    postedBy: ObjectId;
    postedByName: string;
    title: string;
    body: string;
  }): Promise<Either<ErrorResponse, string>> {
    const newPostData = new PostsData(
      postedBy,
      postedByName,
      title,
      body,
      0,
      0
    );
    const result = await this.postsRepository.createPost(newPostData);
    return result;
  }
}
