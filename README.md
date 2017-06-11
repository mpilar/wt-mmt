# WT-MMT: WebTask Mail Mail Tracker
A sample webtask.io application that receives emails from IFTTT and searches them for tracking numbers and stores them. An aditional two cronjobs can be used to update and send an email when the package arrives.

## Configuration
Several secrets are configurable:

#### nodemailer configuration
###### nodemailer Transport
- `MAIL_USER` - user for authentication
- `MAIL_PASSWORD` - password for authentication
- `MAIL_SERVICE` - if using a well known service for nodemailer this sets it
- `MAIL_HOST` - server setting
- `MAIL_PORT` - server setting
- `MAIL_SECURE` - server setting

###### nodemailer email
- `MAIL_FROM_ADDRESS` - From address to use (alternatively `MAIL_USER` will be used).
- `MAIL_TO` - Where to send the email (alternatively `MAIL_USER` will be used).
- `MAIL_SUBJECT` - Custom subject to use for email being sent.

#### shipit Carrier configuration
There are many configuration options. See [`configCarriers`](https://github.com/mpilar/wt-mmt/blob/master/mmt-main.js#L183) for details.

## TODOs
Other than the TODOs in the code, there are a few overall tasks left:

- **Security**: Oh god I really need to review the security model for this, althogh it behaves sufficiently like a black box (should leak nothing to anyone that stumbles into it on the wild)
- Cleanup the config code.
- The `cron-update` code saves state too many times.
- Now that I think about it, some packages get stuck in the initial state for a really long time, date tracking should be added so that old tracking numbers can be automatically deleted.
- Handle errors better.

## Untested
A ton of stuff is untested because I don't have enough "in transit" packages in varied states.

A short list:

- Most tracking number detection is actually untested, depending on shipit's validation
- Only USPS and Amazon APIs are tested, but the configuration should be straightforward.
- Meta commands (through webtask's CRON) are untested

## Not working:
Some stuff is definitely broken:

- Amazon client in shipit seems to be broken.
- There is a deprecation warning because of [sailrish/shipit#32](https://github.com/sailrish/shipit/issues/32)