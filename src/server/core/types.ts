import { Comment, Post } from "@devvit/web/server";

export interface NukeProps {
    remove: boolean;
    lock: boolean;
    skipDistinguished: boolean;
    skipAlreadyActioned: boolean;
    target: Post | Comment;
}
