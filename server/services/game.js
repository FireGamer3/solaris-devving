const moment = require('moment');
const ValidationError = require('../errors/validation');

module.exports = class GameService {

    constructor(gameModel, userService) {
        this.gameModel = gameModel;
        this.userService = userService;
    }

    async getById(id, select) {
        return await this.gameModel.findById(id)
            .select(select)
            .exec();
    }

    async getByIdGalaxy(id, select) {
        return await this.getById(id, {
            settings: 1,
            state: 1,
            galaxy: 1,
            constants: 1
        });
    }

    async getByIdInfo(id) {
        return await this.getById(id, {
            settings: 1,
            state: 1
        });
    }

    async getByIdMessages(id) {
        return await this.getById(id, {
            settings: 1,
            state: 1,
            messages: 1,
            'galaxy.players': 1
        });
    }

    async join(game, userId, playerId, alias) {
        // Only allow join if the game hasn't started.
        if (game.state.startDate) {
            throw new ValidationError('The game has already started.');
        }

        // Only allow join if the game hasn't finished.
        if (game.state.endDate) {
            throw new ValidationError('The game has already finished.');
        }

        // Disallow if they are already in the game as another player.
        let existing = game.galaxy.players.find(x => x.userId === userId);

        if (existing) {
            throw new ValidationError('The user is already participating in this game.');
        }

        // Get the player and update it to assign the user to the player.
        let player = game.galaxy.players.find(x => x._id.toString() === playerId);

        if (!player) {
            throw new ValidationError('The player is not participating in this game.');
        }

        // Only allow if the player isn't already occupied.
        if (player && player.userId) {
            throw new ValidationError('This player spot has already been taken by another user.');
        }

        // TODO: Factor in player type setting. i.e premium players only.

        // Assign the user to the player.
        player.userId = userId;
        player.alias = alias;

        // If the max player count is reached then start the game.
        let playerCount = game.galaxy.players.filter(p => p.userId).length;

        if (playerCount === game.settings.general.playerLimit) {
            let start = moment();

            game.state.paused = false;
            game.state.startDate = start.toDate();
            game.state.lastTickDate = start.toDate();
            // TODO: When the game first begins, should we start at normal game speed?
            // Or should we have a wait period before the game actually starts?
            game.state.nextTickDate = start.add(game.settings.gameTime.speed, 'm').toDate();
        }

        return await game.save();
    }

    async quit(game, userId) {    
        // TODO: Something to prevent the user from being able rejoin a game.

        // Get the player that is linked to this user.
        let player = game.galaxy.players.find(x => x.userId == userId);

        if (!player) {
            throw new ValidationError('The user is not participating in this game.');
        }

        if (game.state.startDate) {
            throw new ValidationError('Cannot quit a game that has started.');
        }

        if (game.state.endDate) {
            throw new ValidationError('Cannot quit a game that has finished.');
        }

        // TODO: Something to consider here is whether the player has done something
        // to their empire, i.e upgrading stars etc, we should prevent the player from
        // doing this otherwise we'd have to reset everything here which will be a pain.
        player.userId = null;
        player.alias = "Empty Slot";

        await game.save();

        return player;
    }

    async concedeDefeat(game, userId) {    
        // Get the player that is linked to this user.
        let player = game.galaxy.players.find(x => x.userId == userId);

        if (!player) {
            throw new ValidationError('The user is not participating in this game.');
        }

        if (player.defeated) {
            throw new ValidationError('The player has already been defeated.');
        }

        if (!game.state.startDate) {
            throw new ValidationError('Cannot concede defeat in a game that has not yet started.');
        }

        if (game.state.endDate) {
            throw new ValidationError('Cannot concede defeat in a game that has finished.');
        }

        player.defeated = true;

        // Do a winner check here for last man standing as it's possible that everyone might admit
        // or be legit defeated on the same tick.
        // TODO: This could be refactored into a new service as it's currently also being done in the game
        // tick service.
        let undefeatedPlayers = game.galaxy.players.filter(p => !p.defeated);

        if (undefeatedPlayers.length === 1) {
            let winner = undefeatedPlayers[0];

            game.state.paused = true;
            game.state.endDate = new Date();
            game.state.winner = winner._id;
        }

        return await game.save();
    }

    async getPlayerUser(game, playerId) {
        let player = game.galaxy.players.find(p => p.id === playerId);

        return await this.userService.getById(player.userId);
    }

};
