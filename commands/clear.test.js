import clearCommand from './clear';

describe('clear() command', () => {
    let callback;

    describe('when the clear is successful', () => {

        it("should execute the clear function", () => {
            const storage = {
                set: jest.fn().mockReturnValueOnce(() => true)
            }
            callback = jest.fn()

            clearCommand(storage, callback);

            expect(storage.set.mock.calls.length).toBe(1);
            expect(storage.set.mock.calls[0][0]).toEqual({ trackingIDs: [] });
            expect(storage.set.mock.calls[0][1]).toEqual({ force: 1 });
        });
    });
})
