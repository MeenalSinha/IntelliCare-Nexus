from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
print(pwd_context.verify("Demo@2024", "$2b$12$bz/gPmOno3Ag/mXQBy5l9OJHBjiABHc5ZOrAq9KzRknfdjkiVCa4O"))
