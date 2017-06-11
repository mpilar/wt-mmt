import cronEmailCommand from './cron-email';

describe('cronEmail() command', () => {
    let callback;

    describe('when the email is successful', () => {

        it("should execute the clear function", () => {
            const storage = {
                set: jest.fn().mockReturnValueOnce(() => true),
                get: jest.fn().mockReturnValueOnce(() => true)
            }
            callback = jest.fn()

            cronEmailCommand(secrets, storage, callback);
        });
    });
})
