/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { compose } from 'recompose';
import { withStyles } from '@material-ui/core';
import { withSnackbar } from 'notistack';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import CloseIcon from '@material-ui/icons/Close';
import ForwardTargetChat from '../Tile/ForwardTargetChat';
import { canSendMessages, getChatUsername, isSupergroup } from '../../Utils/Chat';
import { loadChatsContent } from '../../Utils/File';
import { NOTIFICATION_AUTO_HIDE_DURATION_MS } from '../../Constants';
import FileStore from '../../Stores/FileStore';
import UserStore from '../../Stores/UserStore';
import ApplicationStore from '../../Stores/ApplicationStore';
import TdLibController from '../../Controllers/TdLibController';
import './ForwardDialog.css';
import { borderStyle } from '../Theme';

const styles = theme => ({
    close: {
        padding: theme.spacing.unit / 2
    },
    borderColor: {
        borderTop: '1px solid ' + theme.palette.divider
    }
});

class ForwardDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            chatIds: [],
            savedMessages: null
        };

        this.messageRef = React.createRef();

        this.targetChats = new Map();
    }

    componentDidMount() {
        this.loadContent();
    }

    loadContent = async () => {
        this.getPublicMessageLink();

        const promises = [];
        const getChatsPromise = TdLibController.send({
            '@type': 'getChats',
            offset_order: '9223372036854775807',
            offset_chat_id: 0,
            limit: 100
        });
        promises.push(getChatsPromise);

        const me = UserStore.getMe();
        const savedMessagesPromise = TdLibController.send({
            '@type': 'createPrivateChat',
            user_id: me.id,
            force: true
        });
        promises.push(savedMessagesPromise);

        const [chats, savedMessages] = await Promise.all(promises.map(x => x.catch(e => null)));

        this.setState({
            chatIds: chats.chat_ids,
            savedMessages: savedMessages
        });

        const store = FileStore.getStore();
        loadChatsContent(store, chats.chat_ids);
    };

    getPublicMessageLink = async () => {
        const { chatId, messageIds } = this.props;
        if (messageIds.length > 1) return;
        if (!isSupergroup(chatId)) return;
        if (!getChatUsername(chatId)) return;

        const result = await TdLibController.send({
            '@type': 'getPublicMessageLink',
            chat_id: chatId,
            message_id: messageIds[0],
            for_album: false
        });

        this.setState({
            publicMessageLink: result
        });
    };

    handleClose = () => {
        TdLibController.clientUpdate({
            '@type': 'clientUpdateForwardMessages',
            info: null
        });
    };

    handleCopyLink = () => {
        const { publicMessageLink } = this.state;
        if (!publicMessageLink) return;
        if (!publicMessageLink.link) return;

        const key = `copy_link_${publicMessageLink.link}`;
        const message = 'Link copied';
        const action = null;

        copy(publicMessageLink.link);

        this.handleScheduledAction(key, message, action);
    };

    handleScheduledAction = (key, message, action) => {
        if (!key) return;

        const { enqueueSnackbar, classes } = this.props;
        if (!enqueueSnackbar) return;

        const TRANSITION_DELAY = 150;
        if (
            ApplicationStore.addScheduledAction(key, NOTIFICATION_AUTO_HIDE_DURATION_MS + 2 * TRANSITION_DELAY, action)
        ) {
            enqueueSnackbar(message, {
                autoHideDuration: NOTIFICATION_AUTO_HIDE_DURATION_MS,
                action: [
                    <IconButton
                        key='close'
                        aria-label='Close'
                        color='inherit'
                        className={classes.close}
                        onClick={() => ApplicationStore.removeScheduledAction(key)}>
                        <CloseIcon />
                    </IconButton>
                ]
            });
        }
    };

    handleSend = () => {
        this.handleClose();

        const { chatId, messageIds } = this.props;
        if (!chatId) return;
        if (!messageIds || !messageIds.length) return;

        const message = this.getMessage();

        this.targetChats.forEach(targetChatId => {
            if (message) {
                TdLibController.send({
                    '@type': 'sendMessage',
                    chat_id: targetChatId,
                    reply_to_message_id: 0,
                    disable_notifications: false,
                    from_background: false,
                    reply_markup: null,
                    input_message_content: {
                        '@type': 'inputMessageText',
                        text: {
                            '@type': 'formattedText',
                            text: message,
                            entities: null
                        },
                        disable_web_page_preview: true,
                        clear_draft: false
                    }
                });
            }

            TdLibController.send({
                '@type': 'forwardMessages',
                chat_id: targetChatId,
                from_chat_id: chatId,
                message_ids: messageIds,
                disable_notifications: false,
                from_background: false,
                as_album: false
            });
        });
    };

    handleChangeSelection = chatId => {
        if (this.targetChats.has(chatId)) {
            this.targetChats.delete(chatId);
        } else {
            this.targetChats.set(chatId, chatId);
        }

        console.log(this.targetChats);

        this.forceUpdate();
    };

    getMessage = () => {
        const innerText = this.messageRef.current.innerText;
        const innerHTML = this.messageRef.current.innerHTML;

        if (innerText && innerText === '\n' && innerHTML && (innerHTML === '<br>' || innerHTML === '<div><br></div>')) {
            this.messageRef.current.innerHTML = '';
        }

        return innerText;
    };

    render() {
        const { classes } = this.props;
        const { chatIds, savedMessages, publicMessageLink } = this.state;

        let chats = savedMessages
            ? [savedMessages.id].concat(chatIds.filter(x => x !== savedMessages.id)).filter(x => canSendMessages(x))
            : chatIds;

        chats = chats.map(x => (
            <ForwardTargetChat
                key={x}
                chatId={x}
                selected={this.targetChats.has(x)}
                onSelect={() => this.handleChangeSelection(x)}
            />
        ));

        return (
            <Dialog
                open={true}
                onClose={this.handleClose}
                aria-labelledby='forward-dialog-title'
                aria-describedby='forward-dialog-description'>
                <DialogTitle id='forward-dialog-title'>Share to</DialogTitle>
                <DialogContent>
                    <div className='forward-dialog-list'>{chats}</div>
                </DialogContent>
                <div className={classes.borderColor} />
                {this.targetChats.size > 0 && (
                    <div
                        ref={this.messageRef}
                        id='forward-dialog-message'
                        contentEditable
                        suppressContentEditableWarning
                        placeholder='Type a message'
                    />
                )}
                <DialogActions>
                    <Button onClick={this.handleClose} color='primary'>
                        Cancel
                    </Button>
                    {this.targetChats.size > 0 && (
                        <Button onClick={this.handleSend} color='primary' autoFocus>
                            Send
                        </Button>
                    )}
                    {!this.targetChats.size && publicMessageLink && (
                        <Button onClick={this.handleCopyLink} color='primary'>
                            Copy share link
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        );
    }
}

ForwardDialog.PropTypes = {
    chatId: PropTypes.number.isRequired,
    messageIds: PropTypes.array.isRequired
};

const enhance = compose(
    withStyles(styles, { withTheme: true }),
    withSnackbar
);

export default enhance(ForwardDialog);
