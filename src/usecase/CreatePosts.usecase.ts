import { ObjectId } from "mongodb";
import { ErrorResponse } from "../core/entity/ErrorRespose.entity";
import { PostsRepository } from "../core/repository/PostsRepository";
import { Either } from "../utils/Either";
import { PostsData } from "../core/entity/PostsData.entity";

export class CreatePostUsecase {
  constructor(private postsRepository: PostsRepository) {}

  async execute({
    postedBy,
    title,
    body,
  }: {
    postedBy: ObjectId;
    title: string;
    body: string;
  }): Promise<Either<ErrorResponse, string>> {
    const newPostData = new PostsData(postedBy, title, body);
    const result = await this.postsRepository.createPost(newPostData);
    return result;
  }
}
