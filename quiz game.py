while True:
    quiz={"What is the capital of France?":"paris",
          "What is 5+7":"12",
          "What color do you get when you mix red and white?":"pink",
          "Who wrote 'Harry Potter'?":"jk rowling"}
    score=0
    for question, answer in quiz.items():
        user_answer=input(f"{question}\n").lower()
        if user_answer == answer:
            print("Correct!!")
            score+=1
        else:
            print("Incorrect...")
    print(f"Your final score is {score} / {len(quiz)}")

    if score>2:
        print("Good Job!!")
    else:
        print("You need to improve your GK")
    restart=input("Do you want to restart the game?type 'yes' or 'no'").lower()
    if restart!="yes":
        print("Thank you for playing")
        break

