$(function () {

    var userName;

    var client = new WindowsAzure.MobileServiceClient('https://ostoslista.azure-mobile.net/', 'wFWmmDhjlWzQVQzuFTxIxRTKhdBrSx70'),
        todoItemTable = client.getTable('todoitem'),
        listTable = client.getTable('list'),
        listPermissionTable = client.getTable('listpermission');
        
    function refreshLists() {
        var query = listPermissionTable.where({});
        query.read().then(function (listPermissionItems) {
            if (listPermissionItems.length == 0) {
                listPermissionTable.insert({ listName: "OLETUS", userName: userName }).then(refreshLists, handleError);
                return;
            }

            var options = $('#lists');
            $.each(listPermissionItems, function () {
                options.append($("<option />").val(this.id).text(this.listName));
            });

            refreshTodoItems();
        }, handleError);
    }

    // Read current data and rebuild UI.
    // If you plan to generate complex UIs like this, consider using a JavaScript templating library.
    function refreshTodoItems() {
        var query = todoItemTable.where({ complete: false });

        query.read().then(function(todoItems) {
            var listItems = $.map(todoItems, function(item) {
                return $('<li>')
                    .attr('data-todoitem-id', item.id)
                    .append($('<button class="item-delete">Delete</button>'))
                    .append($('<input type="checkbox" class="item-complete">').prop('checked', item.complete))
                    .append($('<div>').append($('<input class="item-text">').val(item.text)));
            });

            $('#todo-items').empty().append(listItems).toggle(listItems.length > 0);
            $('#summary').html('<strong>' + todoItems.length + '</strong> asiaa listalla');
        }, handleError);
    }

    function handleError(error) {
        var text = error + (error.request ? ' - ' + error.request.status : '');
        $('#errorlog').append($('<li>').text(text));
    }

    function getTodoItemId(formElement) {
        return Number($(formElement).closest('li').attr('data-todoitem-id'));
    }

    // Handle insert
    $('#add-item').submit(function(evt) {
        var textbox = $('#new-item-text'),
            itemText = textbox.val();
        if (itemText !== '') {
            todoItemTable.insert({ text: itemText, complete: false }).then(refreshTodoItems, handleError);
        }
        textbox.val('').focus();
        evt.preventDefault();
    });

    // Handle update
    $(document.body).on('change', '.item-text', function() {
        var newText = $(this).val();
        todoItemTable.update({ id: getTodoItemId(this), text: newText }).then(null, handleError);
    });

    $(document.body).on('change', '.item-complete', function() {
        var isComplete = $(this).prop('checked');
        todoItemTable.update({ id: getTodoItemId(this), complete: isComplete }).then(refreshTodoItems, handleError);
    });

    // Handle delete
    $(document.body).on('click', '.item-delete', function () {
        todoItemTable.del({ id: getTodoItemId(this) }).then(refreshTodoItems, handleError);
    });

    function refreshAuthDisplay() {
        var isLoggedIn = client.currentUser !== null;
        $("#logged-in").toggle(isLoggedIn);
        $("#logged-out").toggle(!isLoggedIn);

        if (isLoggedIn) {
            client.invokeApi("getfbaccesstoken", {
                body: null,
                method: "post"
            }).done(function (results) {
                var responseString = results.response;
                var responseJson = JSON.parse(responseString);
                var accessToken = responseJson.accessToken;
                FB.api('/me?access_token=' + accessToken, function (response) {
                    userName = response.name;
                    $("#login-name").text(userName);
                    refreshLists();
                });
            }, handleError);
        }
    }

    function logIn() {
        client.login("facebook").then(refreshAuthDisplay, function (error) {
            alert(error);
        });
    }

    function logOut() {
        client.logout();
        refreshAuthDisplay();
        $('#summary').html('<strong>You must login to access data.</strong>');
    }

    // On page init, fetch the data and set up event handlers
    $(function () {
        refreshAuthDisplay();
        $('#summary').html('<strong>You must login to access data.</strong>');
        $("#logged-out button").click(logIn);
        $("#logged-in button").click(logOut);
    });
});